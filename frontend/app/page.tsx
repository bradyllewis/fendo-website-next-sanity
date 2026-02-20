import HeroSection from '@/app/components/home/HeroSection'
import StatsStrip from '@/app/components/home/StatsStrip'
import FeatureBlocks from '@/app/components/home/FeatureBlocks'
import TestimonialsSection from '@/app/components/home/TestimonialsSection'
import GearCallout from '@/app/components/home/GearCallout'
import ManifestoStrip from '@/app/components/home/ManifestoStrip'
import LatestPosts from '@/app/components/home/LatestPosts'

export default async function Page() {
  return (
    <>
      <HeroSection />
      <StatsStrip />
      <FeatureBlocks />
      <TestimonialsSection />
      <GearCallout />
      <ManifestoStrip />
      <LatestPosts />
    </>
  )
}
