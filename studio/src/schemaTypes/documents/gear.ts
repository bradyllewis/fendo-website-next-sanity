import {SparklesIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

/**
 * Gear schema — Physical products available in the Fendo shop.
 * Used on the /gear page and the homepage GearCallout section.
 */

export const gear = defineType({
  name: 'gear',
  title: 'Gear',
  icon: SparklesIcon,
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Product Name',
      type: 'string',
      description: 'Full product name, e.g. "GS1 Groove System".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
        maxLength: 96,
        isUnique: (value, context) => context.defaultIsUnique(value, context),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'tagline',
      title: 'Tagline',
      type: 'string',
      description: 'Short subtitle displayed on cards — e.g. "Groove System" or "The Precision Cleaner".',
    }),
    defineField({
      name: 'category',
      title: 'Category Label',
      type: 'string',
      description: 'Eyebrow label shown above the product name — e.g. "Performance Tools", "Accessories".',
    }),
    defineField({
      name: 'badge',
      title: 'Badge',
      type: 'string',
      description: 'Optional badge on the product image card — e.g. "Flagship Product", "New", "Best Seller".',
    }),
    defineField({
      name: 'shortDescription',
      title: 'Short Description',
      type: 'text',
      rows: 3,
      description: 'Shown on the gear page and homepage callout. Keep under 200 characters.',
      validation: (rule) => rule.max(250),
    }),
    defineField({
      name: 'features',
      title: 'Feature Bullets',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Key product features shown as a bullet list.',
    }),
    defineField({
      name: 'price',
      title: 'Price (USD)',
      type: 'number',
      description: 'Display price in USD. Leave blank if not shown publicly.',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'shopUrl',
      title: 'Shop URL',
      type: 'url',
      description: 'Direct link to buy this product in the Fendo shop.',
      validation: (rule) => rule.required().uri({allowRelative: false}),
    }),
    defineField({
      name: 'image',
      title: 'Product Image',
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
          description: 'Describe the product for screen readers and SEO.',
          validation: (rule) => rule.required(),
        },
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'isFeatured',
      title: 'Feature on Homepage Callout',
      type: 'boolean',
      description: 'When enabled, this product appears as the hero callout on the homepage.',
      initialValue: false,
    }),
    defineField({
      name: 'displayOrder',
      title: 'Display Order',
      type: 'number',
      description: 'Controls the order products appear on the Gear page. Lower numbers appear first.',
      initialValue: 0,
    }),
  ],
  orderings: [
    {
      title: 'Display Order',
      name: 'displayOrder',
      by: [
        {field: 'displayOrder', direction: 'asc'},
        {field: 'name', direction: 'asc'},
      ],
    },
    {
      title: 'Featured First',
      name: 'featuredFirst',
      by: [
        {field: 'isFeatured', direction: 'desc'},
        {field: 'displayOrder', direction: 'asc'},
      ],
    },
  ],
  preview: {
    select: {
      title: 'name',
      tagline: 'tagline',
      media: 'image',
      isFeatured: 'isFeatured',
      price: 'price',
    },
    prepare({title, tagline, media, isFeatured, price}) {
      const featuredMark = isFeatured ? '★ Featured · ' : ''
      const priceLabel = price != null ? ` · $${price}` : ''
      return {
        title,
        media,
        subtitle: `${featuredMark}${tagline ?? ''}${priceLabel}`.trim().replace(/^·\s*/, ''),
      }
    },
  },
})
