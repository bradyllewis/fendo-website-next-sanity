import {ImageIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

/**
 * Media Asset schema — Images and videos for portfolio/gallery components.
 * Supports both uploaded files and external source URLs.
 */

export const mediaAsset = defineType({
  name: 'mediaAsset',
  title: 'Media Asset',
  icon: ImageIcon,
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'mediaType',
      title: 'Media Type',
      type: 'string',
      options: {
        list: [
          {title: 'Image', value: 'image'},
          {title: 'Video', value: 'video'},
        ],
        layout: 'radio',
      },
      initialValue: 'image',
      validation: (rule) => rule.required(),
    }),
    // ── Image fields (shown when mediaType === 'image') ───────────────
    defineField({
      name: 'uploadedImage',
      title: 'Uploaded Image',
      type: 'image',
      description: 'Upload an image file directly to Sanity.',
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
          description: 'Describe the image for screen readers and SEO.',
        },
      ],
      hidden: ({document}) => document?.mediaType !== 'image',
    }),
    defineField({
      name: 'imageSourceUrl',
      title: 'Image Source URL',
      type: 'url',
      description: 'OR paste an external image URL instead of uploading.',
      hidden: ({document}) => document?.mediaType !== 'image',
    }),
    // ── Video fields (shown when mediaType === 'video') ───────────────
    defineField({
      name: 'uploadedVideo',
      title: 'Uploaded Video File',
      type: 'file',
      description: 'Upload an mp4/webm video file directly to Sanity.',
      options: {
        accept: 'video/*',
      },
      hidden: ({document}) => document?.mediaType !== 'video',
    }),
    defineField({
      name: 'videoSourceUrl',
      title: 'Video Source URL',
      type: 'url',
      description: 'OR paste an external video URL (mp4/webm/YouTube embed).',
      hidden: ({document}) => document?.mediaType !== 'video',
    }),
    defineField({
      name: 'thumbnailImage',
      title: 'Thumbnail / Poster Image',
      type: 'image',
      description: 'Used as the preview image for video assets.',
      options: {hotspot: true},
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternative text',
        },
      ],
      hidden: ({document}) => document?.mediaType !== 'video',
    }),
    // ── Shared metadata ───────────────────────────────────────────────
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
      description: 'Short caption shown below the asset in portfolios.',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{type: 'string'}],
      options: {layout: 'tags'},
      description: 'e.g. "tournament", "short-game", "collective"',
    }),
    defineField({
      name: 'dateTaken',
      title: 'Date Taken / Published',
      type: 'date',
    }),
    defineField({
      name: 'credit',
      title: 'Photo / Video Credit',
      type: 'string',
    }),
    defineField({
      name: 'isFeatured',
      title: 'Feature in gallery hero',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      mediaType: 'mediaType',
      uploadedImage: 'uploadedImage',
      thumbnailImage: 'thumbnailImage',
      tags: 'tags',
    },
    prepare({title, mediaType, uploadedImage, thumbnailImage, tags}) {
      const media = mediaType === 'image' ? uploadedImage : thumbnailImage
      const tagStr = tags?.length ? tags.slice(0, 3).join(', ') : ''
      return {
        title,
        media,
        subtitle: [mediaType?.toUpperCase(), tagStr].filter(Boolean).join(' · '),
      }
    },
  },
})
