import {BookIcon} from '@sanity/icons'
import {format, parseISO} from 'date-fns'
import {defineField, defineType} from 'sanity'

/**
 * Playbook schema — Educational articles, videos, guides, and drills.
 * Used on the /playbook page to surface learning content and resources.
 */

export const playbook = defineType({
  name: 'playbook',
  title: 'Playbook',
  icon: BookIcon,
  type: 'document',
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'media', title: 'Media & Attachments'},
    {name: 'meta', title: 'Metadata & Publishing'},
  ],
  fields: [
    // ── Core ────────────────────────────────────────────────────────────────
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'content',
      options: {
        source: 'title',
        maxLength: 96,
        isUnique: (value, context) => context.defaultIsUnique(value, context),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'contentType',
      title: 'Content Type',
      type: 'string',
      group: 'content',
      description: 'What kind of content is this? Used for filtering on the Playbook page.',
      options: {
        list: [
          {title: 'Article', value: 'article'},
          {title: 'Video', value: 'video'},
          {title: 'Guide', value: 'guide'},
          {title: 'Drill', value: 'drill'},
          {title: 'Tutorial', value: 'tutorial'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      group: 'content',
      description: 'Primary golf category — helps players find relevant content.',
      options: {
        list: [
          {title: 'Short Game', value: 'short-game'},
          {title: 'Putting', value: 'putting'},
          {title: 'Chipping & Pitching', value: 'chipping'},
          {title: 'Bunker Play', value: 'bunker-play'},
          {title: 'Full Swing', value: 'full-swing'},
          {title: 'Course Management', value: 'course-management'},
          {title: 'Mental Game', value: 'mental-game'},
          {title: 'Fitness & Conditioning', value: 'fitness'},
          {title: 'Equipment & Gear', value: 'equipment'},
          {title: 'Rules & Etiquette', value: 'rules'},
          {title: 'General Golf', value: 'general'},
        ],
      },
    }),
    defineField({
      name: 'difficulty',
      title: 'Difficulty Level',
      type: 'string',
      group: 'content',
      options: {
        list: [
          {title: 'All Levels', value: 'all-levels'},
          {title: 'Beginner', value: 'beginner'},
          {title: 'Intermediate', value: 'intermediate'},
          {title: 'Advanced', value: 'advanced'},
        ],
        layout: 'radio',
      },
      initialValue: 'all-levels',
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      group: 'content',
      of: [{type: 'string'}],
      options: {layout: 'tags'},
      description: 'Flexible search tags (e.g., "wedge", "alignment", "routine").',
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
      group: 'content',
      description: 'Short summary shown on cards and in search results — keep under 160 characters.',
      validation: (rule) => rule.max(200),
    }),
    defineField({
      name: 'body',
      title: 'Body Content',
      type: 'blockContent',
      group: 'content',
      description: 'Full article/guide content with rich text, images, and links.',
    }),

    // ── Media ────────────────────────────────────────────────────────────────
    defineField({
      name: 'coverImage',
      title: 'Cover Image',
      type: 'image',
      group: 'media',
      options: {
        hotspot: true,
        aiAssist: {
          imageDescriptionField: 'alt',
        },
      },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternative text',
          description: 'Important for SEO and accessibility.',
        },
      ],
    }),
    defineField({
      name: 'video',
      title: 'Video',
      type: 'object',
      group: 'media',
      description: 'Optional video content. Choose your platform below.',
      fields: [
        defineField({
          name: 'platform',
          title: 'Video Platform',
          type: 'string',
          options: {
            list: [
              {title: 'YouTube', value: 'youtube'},
              {title: 'Vimeo', value: 'vimeo'},
              {title: 'Uploaded File', value: 'uploaded'},
            ],
            layout: 'radio',
          },
        }),
        defineField({
          name: 'embedId',
          title: 'Video ID',
          type: 'string',
          description: 'YouTube: https://youtube.com/watch?v=THIS_ID — Vimeo: https://vimeo.com/THIS_ID',
          hidden: ({parent}) =>
            !parent?.platform || !['youtube', 'vimeo'].includes(parent.platform as string),
        }),
        defineField({
          name: 'url',
          title: 'Direct Video URL',
          type: 'url',
          description: 'Use for platforms other than YouTube/Vimeo.',
          hidden: ({parent}) =>
            parent?.platform === 'youtube' ||
            parent?.platform === 'vimeo' ||
            parent?.platform === 'uploaded',
        }),
        defineField({
          name: 'uploadedFile',
          title: 'Uploaded Video File',
          type: 'file',
          description: 'Upload an MP4 or WebM video file.',
          options: {
            accept: 'video/*',
          },
          hidden: ({parent}) => parent?.platform !== 'uploaded',
        }),
        defineField({
          name: 'duration',
          title: 'Duration',
          type: 'string',
          description: 'Video length in mm:ss format (e.g., "12:34").',
          placeholder: '12:34',
        }),
      ],
    }),
    defineField({
      name: 'attachments',
      title: 'Downloadable Attachments',
      type: 'array',
      group: 'media',
      description: 'PDFs, worksheets, scorecards, or other files for readers to download.',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'title',
              title: 'Attachment Title',
              type: 'string',
              description: 'e.g., "Short Game Drill Sheet", "Putting Checklist"',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'description',
              title: 'Description',
              type: 'text',
              rows: 2,
              description: 'Optional — briefly explain what this file contains.',
            }),
            defineField({
              name: 'fileType',
              title: 'File Type',
              type: 'string',
              options: {
                list: [
                  {title: 'PDF', value: 'pdf'},
                  {title: 'Worksheet', value: 'worksheet'},
                  {title: 'Scorecard', value: 'scorecard'},
                  {title: 'Drill Sheet', value: 'drill-sheet'},
                  {title: 'Checklist', value: 'checklist'},
                  {title: 'Spreadsheet', value: 'spreadsheet'},
                  {title: 'Other', value: 'other'},
                ],
                layout: 'radio',
              },
              initialValue: 'pdf',
            }),
            defineField({
              name: 'file',
              title: 'File',
              type: 'file',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {title: 'title', fileType: 'fileType'},
            prepare({title, fileType}) {
              return {
                title: title || 'Untitled Attachment',
                subtitle: fileType ? fileType.toUpperCase() : 'FILE',
              }
            },
          },
        },
      ],
    }),

    // ── Author & Contributors ────────────────────────────────────────────────
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      group: 'meta',
      to: [{type: 'person'}],
    }),
    defineField({
      name: 'contributors',
      title: 'Additional Contributors',
      type: 'array',
      group: 'meta',
      of: [{type: 'reference', to: [{type: 'person'}]}],
      description: 'Co-authors, coaches, or other contributors featured in this piece.',
    }),
    defineField({
      name: 'relatedPlaybooks',
      title: 'Related Playbook Entries',
      type: 'array',
      group: 'meta',
      of: [{type: 'reference', to: [{type: 'playbook'}]}],
      description: 'Link to related articles, guides, or drills to surface at the bottom of this post.',
      validation: (rule) => rule.max(4),
    }),

    // ── Publishing ───────────────────────────────────────────────────────────
    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
      group: 'meta',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'isFeatured',
      title: 'Feature on /playbook page',
      type: 'boolean',
      group: 'meta',
      description: 'Only one entry should be featured at a time — shown as a hero card.',
      initialValue: false,
    }),
    defineField({
      name: 'isPremium',
      title: 'Collective Members Only',
      type: 'boolean',
      group: 'meta',
      description: 'Mark this content as exclusive to Fendo Collective members.',
      initialValue: false,
    }),
    defineField({
      name: 'displayOrder',
      title: 'Display Order',
      type: 'number',
      group: 'meta',
      description: 'Lower numbers appear first. Leave blank to sort by publish date.',
    }),
  ],
  orderings: [
    {
      title: 'Published (Newest First)',
      name: 'publishedAtDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
    {
      title: 'Display Order',
      name: 'displayOrderAsc',
      by: [
        {field: 'displayOrder', direction: 'asc'},
        {field: 'publishedAt', direction: 'desc'},
      ],
    },
    {
      title: 'Featured First',
      name: 'featuredFirst',
      by: [
        {field: 'isFeatured', direction: 'desc'},
        {field: 'publishedAt', direction: 'desc'},
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
      contentType: 'contentType',
      category: 'category',
      publishedAt: 'publishedAt',
      isFeatured: 'isFeatured',
      media: 'coverImage',
    },
    prepare({title, contentType, category, publishedAt, isFeatured, media}) {
      const typeLabel = contentType
        ? contentType.charAt(0).toUpperCase() + contentType.slice(1)
        : ''
      const dateLabel = publishedAt ? format(parseISO(publishedAt), 'MMM d, yyyy') : ''
      const featuredLabel = isFeatured ? '★ Featured' : ''
      return {
        title,
        media,
        subtitle: [typeLabel, category, dateLabel, featuredLabel].filter(Boolean).join(' · '),
      }
    },
  },
})
