import {StarIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const sponsorshipTier = defineType({
  name: 'sponsorshipTier',
  title: 'Sponsorship Tier',
  icon: StarIcon,
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Tier Name',
      type: 'string',
      description: 'e.g. Gold, Silver, Presenting Sponsor',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'price',
      title: 'Price (USD)',
      type: 'number',
      validation: (r) => r.required().min(0),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
      description: 'Brief summary shown to potential sponsors.',
    }),
    defineField({
      name: 'benefits',
      title: 'Benefits',
      type: 'array',
      of: [{type: 'string'}],
      description: 'One benefit per item — e.g. "Logo on event banner".',
    }),
    defineField({
      name: 'includedPlayerSpots',
      title: 'Included Player Spots',
      type: 'number',
      description: 'Number of complimentary player registrations included.',
      initialValue: 0,
      validation: (r) => r.min(0).integer(),
    }),
  ],
  orderings: [
    {
      title: 'Price (High to Low)',
      name: 'priceDesc',
      by: [{field: 'price', direction: 'desc'}],
    },
    {
      title: 'Price (Low to High)',
      name: 'priceAsc',
      by: [{field: 'price', direction: 'asc'}],
    },
    {
      title: 'Name (A–Z)',
      name: 'nameAsc',
      by: [{field: 'name', direction: 'asc'}],
    },
  ],
  preview: {
    select: {title: 'name', price: 'price', spots: 'includedPlayerSpots'},
    prepare({title, price, spots}) {
      const priceLabel = price != null ? `$${price.toLocaleString()}` : ''
      const spotsLabel = spots > 0 ? `${spots} player spot${spots !== 1 ? 's' : ''}` : ''
      return {
        title: title ?? 'Untitled Tier',
        subtitle: [priceLabel, spotsLabel].filter(Boolean).join(' · '),
      }
    },
  },
})
