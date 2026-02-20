import {CalendarIcon} from '@sanity/icons'
import {format, parseISO} from 'date-fns'
import {defineField, defineType} from 'sanity'

/**
 * Event schema — Tournaments, clinics, and community rounds.
 * Used on the /compete page to surface upcoming and past events.
 */

export const event = defineType({
  name: 'event',
  title: 'Event',
  icon: CalendarIcon,
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Event Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
        isUnique: (value, context) => context.defaultIsUnique(value, context),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'eventType',
      title: 'Event Type',
      type: 'string',
      options: {
        list: [
          {title: 'Tournament', value: 'tournament'},
          {title: 'Clinic', value: 'clinic'},
          {title: 'Community Round', value: 'community_round'},
          {title: 'Sponsored Championship', value: 'sponsored_championship'},
          {title: 'Meetup', value: 'meetup'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Upcoming', value: 'upcoming'},
          {title: 'Registration Open', value: 'registration_open'},
          {title: 'Full — Waitlist', value: 'waitlist'},
          {title: 'Completed', value: 'completed'},
          {title: 'Cancelled', value: 'cancelled'},
        ],
        layout: 'radio',
      },
      initialValue: 'upcoming',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'startDate',
      title: 'Start Date & Time',
      type: 'datetime',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'endDate',
      title: 'End Date & Time',
      type: 'datetime',
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'object',
      fields: [
        defineField({name: 'venueName', title: 'Venue Name', type: 'string'}),
        defineField({name: 'city', title: 'City', type: 'string'}),
        defineField({name: 'state', title: 'State / Region', type: 'string'}),
        defineField({name: 'addressLine', title: 'Street Address', type: 'string'}),
      ],
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover Image',
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
          description: 'Important for SEO and accessibility.',
        },
      ],
    }),
    defineField({
      name: 'shortDescription',
      title: 'Short Description',
      type: 'text',
      rows: 3,
      description: 'Shown on the event card — keep under 160 characters.',
      validation: (rule) => rule.max(200),
    }),
    defineField({
      name: 'description',
      title: 'Full Description',
      type: 'blockContentTextOnly',
      description: 'Detailed event info, rules, schedule, etc.',
    }),
    defineField({
      name: 'spotsTotal',
      title: 'Total Spots Available',
      type: 'number',
      description: 'Leave blank if unlimited.',
      validation: (rule) => rule.positive().integer(),
    }),
    defineField({
      name: 'spotsFilled',
      title: 'Spots Filled',
      type: 'number',
      validation: (rule) => rule.min(0).integer(),
    }),
    defineField({
      name: 'entryFee',
      title: 'Entry Fee (USD)',
      type: 'number',
      description: 'Set to 0 for free events.',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'registrationUrl',
      title: 'Registration / Signup URL',
      type: 'url',
      description: 'External link for registration (e.g., Eventbrite, custom form).',
    }),
    defineField({
      name: 'isFeatured',
      title: 'Feature on /compete page hero',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'sponsors',
      title: 'Sponsors',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'name', title: 'Sponsor Name', type: 'string'}),
            defineField({
              name: 'logo',
              title: 'Sponsor Logo',
              type: 'image',
              options: {hotspot: true},
            }),
            defineField({name: 'url', title: 'Website URL', type: 'url'}),
          ],
          preview: {
            select: {title: 'name', media: 'logo'},
          },
        },
      ],
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{type: 'string'}],
      options: {layout: 'tags'},
    }),
  ],
  orderings: [
    {
      title: 'Start Date (Newest First)',
      name: 'startDateDesc',
      by: [{field: 'startDate', direction: 'desc'}],
    },
    {
      title: 'Start Date (Soonest First)',
      name: 'startDateAsc',
      by: [{field: 'startDate', direction: 'asc'}],
    },
  ],
  preview: {
    select: {
      title: 'title',
      eventType: 'eventType',
      status: 'status',
      startDate: 'startDate',
      media: 'coverImage',
    },
    prepare({title, eventType, status, startDate, media}) {
      const typeLabel = eventType
        ? eventType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        : ''
      const dateLabel = startDate ? format(parseISO(startDate), 'MMM d, yyyy') : ''
      return {
        title,
        media,
        subtitle: [typeLabel, dateLabel, status ? `[${status}]` : ''].filter(Boolean).join(' · '),
      }
    },
  },
})
