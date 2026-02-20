import {StarIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

/**
 * Testimonial schema — Golfer quotes and proof content.
 * Used by TestimonialsSection and any page featuring social proof.
 */

export const testimonial = defineType({
  name: 'testimonial',
  title: 'Testimonial',
  icon: StarIcon,
  type: 'document',
  fields: [
    defineField({
      name: 'quote',
      title: 'Quote',
      type: 'text',
      rows: 4,
      description: 'The golfer\'s testimonial — write in first person.',
      validation: (rule) => rule.required().max(400),
    }),
    defineField({
      name: 'authorName',
      title: 'Author Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'authorDetail',
      title: 'Author Detail',
      type: 'string',
      description: 'e.g. "8 Handicap · Dallas, TX" or "Club Member · Phoenix, AZ"',
    }),
    defineField({
      name: 'authorPhoto',
      title: 'Author Photo',
      type: 'image',
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
          description: 'Name or brief description of the person.',
        },
      ],
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      description: 'Group testimonials by theme.',
      options: {
        list: [
          {title: 'Product (GS1 / Gear)', value: 'product'},
          {title: 'Community / Collective', value: 'community'},
          {title: 'Education / Playbook', value: 'education'},
          {title: 'Events / Tournaments', value: 'events'},
          {title: 'General', value: 'general'},
        ],
        layout: 'radio',
      },
      initialValue: 'general',
    }),
    defineField({
      name: 'rating',
      title: 'Star Rating',
      type: 'number',
      description: '1–5 stars (optional).',
      options: {
        list: [
          {title: '★★★★★  5', value: 5},
          {title: '★★★★☆  4', value: 4},
          {title: '★★★☆☆  3', value: 3},
        ],
      },
      validation: (rule) => rule.min(1).max(5).integer(),
    }),
    defineField({
      name: 'isFeatured',
      title: 'Feature on Homepage',
      type: 'boolean',
      description: 'Show this testimonial in the homepage proof section.',
      initialValue: false,
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published / Submitted At',
      type: 'date',
      initialValue: () => new Date().toISOString().split('T')[0],
    }),
  ],
  orderings: [
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
      quote: 'quote',
      authorName: 'authorName',
      authorDetail: 'authorDetail',
      media: 'authorPhoto',
      category: 'category',
      isFeatured: 'isFeatured',
    },
    prepare({quote, authorName, authorDetail, media, category, isFeatured}) {
      const featured = isFeatured ? '★ Featured · ' : ''
      return {
        title: authorName,
        media,
        subtitle: `${featured}${category ?? ''} · "${quote?.slice(0, 60)}…"`,
      }
    },
  },
})
