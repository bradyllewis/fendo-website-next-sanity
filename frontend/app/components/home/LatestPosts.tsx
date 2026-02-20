import {Suspense} from 'react'

import {AllPosts} from '@/app/components/Posts'

export default async function LatestPosts() {
  return (
    <section className="section-padding" aria-labelledby="playbook-section-heading">
      <div className="container">
        <div className="mb-12">
          <p className="label-mono mb-4">The Playbook</p>
          <h2 id="playbook-section-heading" className="display-md text-fg">
            Latest Articles.
          </h2>
        </div>
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-surface animate-pulse" />
            ))}
          </div>
        }>
          {await AllPosts()}
        </Suspense>
      </div>
    </section>
  )
}
