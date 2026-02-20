# Advanced Row Level Security Patterns

This reference provides production-tested RLS patterns for complex authorization scenarios in Supabase.

## Table of Contents

1. [Hierarchical Access Control](#hierarchical-access-control)
2. [Time-Based Access](#time-based-access)
3. [Attribute-Based Access Control (ABAC)](#attribute-based-access-control)
4. [Dynamic Role Management](#dynamic-role-management)
5. [Cross-Table Policies](#cross-table-policies)
6. [Performance Optimization Techniques](#performance-optimization-techniques)

## Hierarchical Access Control

### Organization > Team > Project Structure

```sql
-- Schema
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_org_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  PRIMARY KEY (user_id, organization_id)
);

CREATE TABLE user_team_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lead', 'member')),
  PRIMARY KEY (user_id, team_id)
);

-- Indexes for performance
CREATE INDEX idx_user_org_roles_user_id ON user_org_roles(user_id);
CREATE INDEX idx_user_team_roles_user_id ON user_team_roles(user_id);
CREATE INDEX idx_teams_org_id ON teams(organization_id);
CREATE INDEX idx_projects_team_id ON projects(team_id);

-- Security definer function for checking org access
CREATE OR REPLACE FUNCTION user_has_org_access(org_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_org_roles
    WHERE user_id = auth.uid() AND organization_id = org_id
  );
$$;

-- Security definer function for checking team access
CREATE OR REPLACE FUNCTION user_has_team_access(t_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_team_roles utr
    WHERE utr.user_id = auth.uid() AND utr.team_id = t_id
  ) OR EXISTS (
    SELECT 1 FROM user_org_roles uor
    INNER JOIN teams t ON t.organization_id = uor.organization_id
    WHERE uor.user_id = auth.uid() AND t.id = t_id
  );
$$;

-- RLS Policies

-- Organizations: users can view orgs they belong to
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING ((SELECT user_has_org_access(id)));

-- Teams: users can view teams in their orgs
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view accessible teams"
  ON teams FOR SELECT
  TO authenticated
  USING ((SELECT user_has_team_access(id)));

-- Projects: users can view projects in accessible teams
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view accessible projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    (SELECT user_has_team_access(team_id))
  );
```

### Role-Based Permissions with Inheritance

```sql
-- Create role hierarchy function
CREATE OR REPLACE FUNCTION get_effective_role(org_id UUID)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
STABLE
AS $$
  SELECT role FROM user_org_roles
  WHERE user_id = auth.uid() AND organization_id = org_id
  ORDER BY 
    CASE role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
    END
  LIMIT 1;
$$;

-- Policy that enforces role hierarchy
CREATE POLICY "Owners and admins can update org"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    (SELECT get_effective_role(id)) IN ('owner', 'admin')
  )
  WITH CHECK (
    (SELECT get_effective_role(id)) IN ('owner', 'admin')
  );

-- Only owners can delete
CREATE POLICY "Only owners can delete org"
  ON organizations FOR DELETE
  TO authenticated
  USING (
    (SELECT get_effective_role(id)) = 'owner'
  );
```

## Time-Based Access

### Subscription/Trial Period Access

```sql
-- Schema
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- Function to check active subscription
CREATE OR REPLACE FUNCTION user_has_active_subscription()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND (
        trial_ends_at IS NULL OR trial_ends_at > now()
      )
      AND (
        subscription_ends_at IS NULL OR subscription_ends_at > now()
      )
  );
$$;

-- Premium features table
CREATE TABLE premium_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE premium_features ENABLE ROW LEVEL SECURITY;

-- Only users with active subscriptions can access premium features
CREATE POLICY "Active subscribers access premium features"
  ON premium_features FOR ALL
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id AND
    (SELECT user_has_active_subscription())
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id AND
    (SELECT user_has_active_subscription())
  );
```

### Scheduled Content Access

```sql
-- Content with publish/unpublish dates
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  unpublished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Authors can view their own articles anytime
CREATE POLICY "Authors view own articles"
  ON articles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = author_id);

-- Public can only view published articles within date range
CREATE POLICY "Public views published articles"
  ON articles FOR SELECT
  TO public
  USING (
    published_at IS NOT NULL
    AND published_at <= now()
    AND (unpublished_at IS NULL OR unpublished_at > now())
  );
```

## Attribute-Based Access Control (ABAC)

### User Attributes and Permissions

```sql
-- User metadata table
CREATE TABLE user_attributes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  department TEXT,
  location TEXT,
  clearance_level INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_attributes_department ON user_attributes(department);
CREATE INDEX idx_user_attributes_clearance ON user_attributes(clearance_level);

-- Documents with attribute requirements
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  required_clearance INT DEFAULT 0,
  allowed_departments TEXT[], -- Array of departments
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Security definer function to get user attributes
CREATE OR REPLACE FUNCTION get_user_clearance()
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(clearance_level, 0)
  FROM user_attributes
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_user_department()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
STABLE
AS $$
  SELECT department
  FROM user_attributes
  WHERE user_id = auth.uid();
$$;

-- ABAC policy
CREATE POLICY "ABAC document access"
  ON documents FOR SELECT
  TO authenticated
  USING (
    (SELECT get_user_clearance()) >= required_clearance
    AND (
      allowed_departments IS NULL
      OR (SELECT get_user_department()) = ANY(allowed_departments)
    )
  );
```

## Dynamic Role Management

### Custom Permissions System

```sql
-- Permissions table
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Role permissions junction
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- User roles junction
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(permission_name TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
    INNER JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND p.name = permission_name
  );
$$;

-- Example usage in policy
CREATE TABLE sensitive_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sensitive_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with read permission can view"
  ON sensitive_data FOR SELECT
  TO authenticated
  USING ((SELECT user_has_permission('sensitive_data.read')));

CREATE POLICY "Users with write permission can insert"
  ON sensitive_data FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT user_has_permission('sensitive_data.write')));
```

## Cross-Table Policies

### Shared Resources with Complex Ownership

```sql
-- Shared documents
CREATE TABLE shared_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document shares
CREATE TABLE document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES shared_documents(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, shared_with_user_id)
);

CREATE INDEX idx_document_shares_user_id ON document_shares(shared_with_user_id);
CREATE INDEX idx_document_shares_doc_id ON document_shares(document_id);

-- Security definer function for checking document access
CREATE OR REPLACE FUNCTION user_can_access_document(doc_id UUID, min_permission TEXT DEFAULT 'view')
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE PLPGSQL
STABLE
AS $$
DECLARE
  is_owner BOOLEAN;
  user_permission TEXT;
  permission_level INT;
  required_level INT;
BEGIN
  -- Check if user is owner
  SELECT EXISTS (
    SELECT 1 FROM shared_documents
    WHERE id = doc_id AND owner_id = auth.uid()
  ) INTO is_owner;

  IF is_owner THEN
    RETURN TRUE;
  END IF;

  -- Get user's permission on document
  SELECT permission INTO user_permission
  FROM document_shares
  WHERE document_id = doc_id AND shared_with_user_id = auth.uid();

  IF user_permission IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Map permissions to levels
  permission_level := CASE user_permission
    WHEN 'view' THEN 1
    WHEN 'edit' THEN 2
    WHEN 'admin' THEN 3
    ELSE 0
  END;

  required_level := CASE min_permission
    WHEN 'view' THEN 1
    WHEN 'edit' THEN 2
    WHEN 'admin' THEN 3
    ELSE 0
  END;

  RETURN permission_level >= required_level;
END;
$$;

-- Policies
ALTER TABLE shared_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view accessible documents"
  ON shared_documents FOR SELECT
  TO authenticated
  USING ((SELECT user_can_access_document(id, 'view')));

CREATE POLICY "Users with edit permission can update"
  ON shared_documents FOR UPDATE
  TO authenticated
  USING ((SELECT user_can_access_document(id, 'edit')))
  WITH CHECK ((SELECT user_can_access_document(id, 'edit')));

CREATE POLICY "Only owners can delete"
  ON shared_documents FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);
```

## Performance Optimization Techniques

### Materialized Views for Complex Queries

```sql
-- Create materialized view for user permissions
CREATE MATERIALIZED VIEW user_effective_permissions AS
SELECT
  ur.user_id,
  p.name as permission_name,
  r.name as role_name
FROM user_roles ur
INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
INNER JOIN permissions p ON rp.permission_id = p.id
INNER JOIN roles r ON ur.role_id = r.id;

CREATE UNIQUE INDEX idx_user_permissions_composite
  ON user_effective_permissions(user_id, permission_name);

-- Refresh function (call after role/permission changes)
CREATE OR REPLACE FUNCTION refresh_user_permissions()
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_effective_permissions;
$$;

-- Optimized permission check using materialized view
CREATE OR REPLACE FUNCTION user_has_permission_fast(permission_name TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_effective_permissions
    WHERE user_id = auth.uid()
      AND permission_name = $1
  );
$$;
```

### Composite Indexes for Complex Policies

```sql
-- For policies that check multiple conditions
CREATE INDEX idx_posts_composite
  ON posts(user_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Partial index for active records only
CREATE INDEX idx_active_subscriptions
  ON subscriptions(user_id)
  WHERE status = 'active' AND subscription_ends_at > now();
```

### Query Plan Analysis

```sql
-- Enable query plan output
ALTER ROLE authenticator SET pgrst.db_plan_enabled TO true;
NOTIFY pgrst, 'reload config';

-- Use .explain() in Supabase client to analyze
-- Then in SQL editor, run problematic query with EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM posts
WHERE user_id IN (
  SELECT team_id FROM team_members WHERE user_id = 'uuid-here'
);

-- Look for:
-- - Sequential Scans (add indexes)
-- - High execution time
-- - Nested loops with large outer tables
```

### Caching Auth Context

```sql
-- Instead of calling auth.uid() multiple times
CREATE OR REPLACE FUNCTION get_cached_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('app.current_user_id', true)
  )::uuid;
$$;

-- Use in policies
CREATE POLICY "Optimized user policy"
  ON posts FOR SELECT
  USING ((SELECT get_cached_user_id()) = user_id);
```

## Testing RLS Policies

```sql
-- Test as specific user
SET request.jwt.claims = '{"sub": "user-uuid-here"}';

-- Run your query
SELECT * FROM posts;

-- Reset
RESET request.jwt.claims;

-- Test with different roles
SET ROLE authenticated;
SELECT * FROM posts;

SET ROLE anon;
SELECT * FROM posts;

RESET ROLE;
```

## Common Pitfalls

1. **Forgetting to add indexes on policy columns** - Always index columns used in policies
2. **Using EXISTS without proper indexes** - Can cause table scans
3. **Not caching auth.uid()** - Wrap in SELECT for performance
4. **Overly complex policies** - Break into security definer functions
5. **Not testing with actual user context** - Always test policies with SET request.jwt.claims
6. **Ignoring EXPLAIN ANALYZE** - Profile queries to find bottlenecks
7. **Using RLS for everything** - Consider server-side validation for complex writes

## Next.js Integration Examples

### Server Action with RLS Bypass for Complex Logic

```typescript
'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function createSharedDocument(formData: FormData) {
  // Use service role to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const title = formData.get('title') as string
  const shareWithEmails = formData.get('shareWith') as string

  // Validate
  if (!title || title.length < 3) {
    return { error: 'Title too short' }
  }

  // Create document
  const { data: doc, error: docError } = await supabase
    .from('shared_documents')
    .insert({
      title,
      owner_id: user.id,
    })
    .select()
    .single()

  if (docError) return { error: docError.message }

  // Share with others
  if (shareWithEmails) {
    const emails = shareWithEmails.split(',').map(e => e.trim())
    
    // Get user IDs from emails
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .in('email', emails)

    if (users && users.length > 0) {
      await supabase
        .from('document_shares')
        .insert(
          users.map(u => ({
            document_id: doc.id,
            shared_with_user_id: u.id,
            permission: 'view',
          }))
        )
    }
  }

  revalidatePath('/documents')
  return { data: doc }
}
```

This reference should be loaded when users need help with complex authorization patterns, performance optimization, or advanced RLS scenarios.