import {defineQuery} from 'next-sanity'

export const settingsQuery = defineQuery(`*[_type == "settings"][0]`)

const postFields = /* groq */ `
  _id,
  "status": select(_originalId in path("drafts.**") => "draft", "published"),
  "title": coalesce(title, "Untitled"),
  "slug": slug.current,
  excerpt,
  coverImage,
  "date": coalesce(date, _updatedAt),
  "author": author->{firstName, lastName, picture},
`

const linkReference = /* groq */ `
  _type == "link" => {
    "page": page->slug.current,
    "post": post->slug.current
  }
`

const linkFields = /* groq */ `
  link {
      ...,
      ${linkReference}
      }
`

export const getPageQuery = defineQuery(`
  *[_type == 'page' && slug.current == $slug][0]{
    _id,
    _type,
    name,
    slug,
    heading,
    subheading,
    "pageBuilder": pageBuilder[]{
      ...,
      _type == "callToAction" => {
        ...,
        button {
          ...,
          ${linkFields}
        }
      },
      _type == "infoSection" => {
        content[]{
          ...,
          markDefs[]{
            ...,
            ${linkReference}
          }
        }
      },
    },
  }
`)

export const sitemapData = defineQuery(`
  *[_type == "page" || _type == "post" && defined(slug.current)] | order(_type asc) {
    "slug": slug.current,
    _type,
    _updatedAt,
  }
`)

export const allPostsQuery = defineQuery(`
  *[_type == "post" && defined(slug.current)] | order(date desc, _updatedAt desc) {
    ${postFields}
  }
`)

export const morePostsQuery = defineQuery(`
  *[_type == "post" && _id != $skip && defined(slug.current)] | order(date desc, _updatedAt desc) [0...$limit] {
    ${postFields}
  }
`)

export const postQuery = defineQuery(`
  *[_type == "post" && slug.current == $slug] [0] {
    content[]{
    ...,
    markDefs[]{
      ...,
      ${linkReference}
    }
  },
    ${postFields}
  }
`)

export const postPagesSlugs = defineQuery(`
  *[_type == "post" && defined(slug.current)]
  {"slug": slug.current}
`)

export const pagesSlugs = defineQuery(`
  *[_type == "page" && defined(slug.current)]
  {"slug": slug.current}
`)

// ─── Events ───────────────────────────────────────────────────────────────────

const eventFields = /* groq */ `
  _id,
  "docStatus": select(_originalId in path("drafts.**") => "draft", "published"),
  title,
  "slug": slug.current,
  eventType,
  status,
  startDate,
  endDate,
  location,
  coverImage,
  shortDescription,
  spotsTotal,
  spotsFilled,
  entryFee,
  registrationUrl,
  isFeatured,
  tags,
`

export const allEventsQuery = defineQuery(`
  *[_type == "event"] | order(startDate asc) {
    ${eventFields}
  }
`)

export const upcomingEventsQuery = defineQuery(`
  *[_type == "event" && status in ["upcoming", "registration_open", "waitlist"]] | order(startDate asc) {
    ${eventFields}
  }
`)

export const featuredEventQuery = defineQuery(`
  *[_type == "event" && isFeatured == true] | order(startDate asc) [0] {
    ${eventFields}
    description,
    sponsors[] {
      name,
      logo,
      url,
    },
  }
`)

// ─── Gear ─────────────────────────────────────────────────────────────────────

const gearFields = /* groq */ `
  _id,
  name,
  "slug": slug.current,
  tagline,
  category,
  badge,
  shortDescription,
  features,
  price,
  shopUrl,
  image,
  isFeatured,
  displayOrder,
`

export const allGearQuery = defineQuery(`
  *[_type == "gear"] | order(displayOrder asc, name asc) {
    ${gearFields}
  }
`)

export const featuredGearQuery = defineQuery(`
  *[_type == "gear" && isFeatured == true] | order(displayOrder asc) [0] {
    ${gearFields}
  }
`)

// ─── Playbook ─────────────────────────────────────────────────────────────────

const playbookFields = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  contentType,
  category,
  difficulty,
  tags,
  coverImage,
  excerpt,
  publishedAt,
  "author": author->{firstName, lastName, picture},
  isFeatured,
  isPremium,
  displayOrder,
`

export const allPlaybooksQuery = defineQuery(`
  *[_type == "playbook"] | order(publishedAt desc) {
    ${playbookFields}
  }
`)

export const featuredPlaybookQuery = defineQuery(`
  *[_type == "playbook" && isFeatured == true] | order(displayOrder asc, publishedAt desc) [0] {
    ${playbookFields}
  }
`)

export const playbookQuery = defineQuery(`
  *[_type == "playbook" && slug.current == $slug] [0] {
    ${playbookFields}
    body,
    "contributors": contributors[]->{firstName, lastName, picture},
    video {
      platform,
      embedId,
      url,
      "fileUrl": uploadedFile.asset->url,
      duration,
    },
    attachments[] {
      _key,
      title,
      description,
      fileType,
      "fileUrl": file.asset->url,
    },
    "relatedPlaybooks": relatedPlaybooks[]->{
      ${playbookFields}
    },
  }
`)

export const playbookSlugQuery = defineQuery(`
  *[_type == "playbook" && defined(slug.current)]
  {"slug": slug.current}
`)

// ─── Testimonials ─────────────────────────────────────────────────────────────

export const featuredTestimonialsQuery = defineQuery(`
  *[_type == "testimonial" && isFeatured == true] | order(publishedAt desc) {
    _id,
    quote,
    authorName,
    authorDetail,
    authorPhoto,
    category,
    rating,
  }
`)
