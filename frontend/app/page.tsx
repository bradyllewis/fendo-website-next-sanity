import HeroSection from '@/app/components/home/HeroSection'
import StatsStrip from '@/app/components/home/StatsStrip'
import UpcomingEvents from '@/app/components/home/UpcomingEvents'
import SpinSloganSection from '@/app/components/home/SpinSloganSection'
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
      <UpcomingEvents count={3} />
      <FeatureBlocks />
      <TestimonialsSection />
      <GearCallout />
      <ManifestoStrip />
      <LatestPosts />
    </>
  )
}
