import SpinSlogan from '@/app/components/SpinSlogan'

export default function SpinSloganSection() {
  return (
    <section className="bg-bg" aria-label="Slogan">
      <div className="container px-0">
        <div className="py-4 md:py-8 flex items-center justify-start">
          <SpinSlogan
            size="md"
            textClassName="text-fg/35"
            autoPlay
          />
        </div>
      </div>
    </section>
  )
}
