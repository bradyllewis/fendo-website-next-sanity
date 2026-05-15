import {TagIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const eventAddOn = defineType({
  name: 'eventAddOn',
  title: 'Event Add-On',
  icon: TagIcon,
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Add-On Name',
      type: 'string',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
      description: 'Optional notes shown to the registrant.',
    }),
    defineField({
      name: 'inputType',
      title: 'Input Type',
      type: 'string',
      options: {
        list: [
          {title: 'Checkbox (yes / no)', value: 'checkbox'},
          {title: 'Text Field (e.g. designee name)', value: 'text'},
        ],
        layout: 'radio',
      },
      initialValue: 'checkbox',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'placeholder',
      title: 'Placeholder Text',
      type: 'string',
      description: 'Text shown inside the field when empty (text fields only).',
      hidden: ({document}) => document?.inputType !== 'text',
    }),
    defineField({
      name: 'category',
      title: 'Category / Group Label',
      type: 'string',
      description:
        'Groups this add-on under a heading in the registration form. Leave blank for ungrouped.',
    }),
    defineField({
      name: 'price',
      title: 'Additional Price (USD)',
      type: 'number',
      description: 'Set to 0 for free add-ons. Charged in addition to the event entry fee.',
      initialValue: 0,
      validation: (r) => r.min(0),
    }),
  ],
  preview: {
    select: {title: 'name', category: 'category', price: 'price'},
    prepare({title, category, price}) {
      const priceLabel = price != null && price > 0 ? `$${price}` : 'Free'
      return {
        title,
        subtitle: [category, priceLabel].filter(Boolean).join(' · '),
      }
    },
  },
})
