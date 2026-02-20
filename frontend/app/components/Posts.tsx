import Link from 'next/link'

import {sanityFetch} from '@/sanity/lib/live'
import {morePostsQuery, allPostsQuery} from '@/sanity/lib/queries'
import {AllPostsQueryResult} from '@/sanity.types'
import DateComponent from '@/app/components/Date'
import OnBoarding from '@/app/components/Onboarding'
import Avatar from '@/app/components/Avatar'
import {dataAttr} from '@/sanity/lib/utils'

const Post = ({post}: {post: AllPostsQueryResult[number]}) => {
  const {_id, title, slug, excerpt, date, author} = post

  return (
    <article
      data-sanity={dataAttr({id: _id, type: 'post', path: 'title'}).toString()}
      key={_id}
      className="card-base p-7 flex flex-col justify-between gap-6 relative cursor-pointer"
    >
      <Link href={`/posts/${slug}`}>
        <span className="absolute inset-0 z-10 rounded-2xl" aria-label={title ?? undefined} />
      </Link>

      <div>
        <h3 className="text-lg font-semibold tracking-tight text-fg mb-3 leading-snug">
          {title}
        </h3>
        {excerpt && (
          <p className="text-sm leading-relaxed text-muted line-clamp-3 max-w-[60ch]">
            {excerpt}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        {author?.firstName && author?.lastName && (
          <Avatar person={author} small={true} />
        )}
        <time className="text-muted-2 text-xs font-mono ml-auto" dateTime={date ?? undefined}>
          <DateComponent dateString={date} />
        </time>
      </div>
    </article>
  )
}

export const MorePosts = async ({skip, limit}: {skip: string; limit: number}) => {
  const {data} = await sanityFetch({
    query: morePostsQuery,
    params: {skip, limit},
  })

  if (!data || data.length === 0) return null

  return (
    <div>
      <p className="label-mono mb-6">More from The Playbook ({data.length})</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((post: AllPostsQueryResult[number]) => (
          <Post key={post._id} post={post} />
        ))}
      </div>
    </div>
  )
}

export const AllPosts = async () => {
  const {data} = await sanityFetch({query: allPostsQuery})

  if (!data || data.length === 0) {
    return <OnBoarding />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.map((post: AllPostsQueryResult[number]) => (
        <Post key={post._id} post={post} />
      ))}
    </div>
  )
}
