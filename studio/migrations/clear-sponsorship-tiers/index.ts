import {defineMigration, at, unset} from 'sanity/migrate'

export default defineMigration({
  title: 'Clear legacy inline sponsorshipTiers (now references)',
  documentTypes: ['event'],
  migrate: {
    document(doc) {
      const tiers = (doc as any).sponsorshipTiers
      if (!Array.isArray(tiers) || tiers.length === 0) return
      // Only unset if the array contains inline objects (not refs)
      const hasInlineObjects = tiers.some(
        (t: any) => t._type !== 'reference' && !t._ref,
      )
      if (!hasInlineObjects) return
      return [at('sponsorshipTiers', unset())]
    },
  },
})
