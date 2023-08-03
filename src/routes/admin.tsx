import { html } from '@elysiajs/html'
import elements from '@kitajs/html'
import { desc, eq } from 'drizzle-orm'
import Elysia, { t } from 'elysia'
import { BaseHtml } from '../components/layout'
import { db } from '../db'
import { Post, posts } from '../db/schema'
import { formatDateTime } from '../utils/intl'
import { md } from '../utils/markdown'

export default function (app: Elysia) {
  return app.group(
    '/admin',
    {
      beforeHandle: ({ set, request: { headers } }) => {
        const basicAuth = headers.get('authorization')?.split(' ')[1] ?? ''
        const [username, password] = Buffer.from(basicAuth, 'base64')
          .toString()
          .split(':')

        const isBadCredentials =
          username !== process.env.ADMIN_USERNAME ||
          password !== process.env.ADMIN_PASSWORD

        if (!headers.get('authorization') || isBadCredentials) {
          set.status = 401
          set.headers['WWW-Authenticate'] = 'Basic realm="Secure Area"'

          return 'Unauthorized'
        }
      },
    },
    (app) =>
      app
        .use(html())
        .get('', async ({ html }) => {
          const allPosts = await db
            .select({
              published: posts.published,
              title: posts.title,
              slug: posts.slug,
            })
            .from(posts)
            .orderBy(desc(posts.id))

          return html(
            <BaseHtml noHeader>
              <h1>Admin</h1>
              <a href="/admin/new">New post</a>
              <ul class="mt-8 space-y-2">
                {allPosts.map((post) => (
                  <li class="flex gap-2 items-center">
                    <a href={`/admin/${post.slug}`}>{post.title}</a>
                    {!post.published ? (
                      <span class="text-xs text-gray-500">(draft)</span>
                    ) : null}
                    <button
                      class="text-red-400"
                      hx-confirm="Are you sure you want to delete this post?"
                      hx-delete={`/admin/${post.slug}`}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </BaseHtml>
          )
        })
        .get(
          '/:slug',
          async ({ html, params }) => {
            let post = {
              body: '',
              excerpt: '',
              longSlug: '',
              published: false,
              series: null,
              slug: params.slug,
              title: '',
            } as Post

            const isNewPost = params.slug === 'new'

            if (!isNewPost) {
              ;[post] = await db
                .select()
                .from(posts)
                .where(eq(posts.slug, params.slug))
            }

            const isDraft = !isNewPost && !post.published

            return html(
              <BaseHtml noHeader path="/admin">
                <div class="flex items-center justify-between">
                  <a href="/admin">← Back</a>
                  {!isNewPost ? (
                    <span class="text-gray-500 dark:text-gray-600">
                      Last updated:{' '}
                      <span id="update-time">
                        {formatDateTime(post.updatedAt, 'medium')}
                      </span>
                    </span>
                  ) : null}
                </div>
                <form
                  action={isNewPost ? `/admin/${post.slug}` : undefined}
                  method={isNewPost ? 'POST' : undefined}
                  hx-patch={!isNewPost ? `/admin/${post.slug}` : undefined}
                  hx-trigger={
                    isDraft
                      ? 'submit, every 1m'
                      : !isNewPost
                      ? 'submit'
                      : undefined
                  }
                  hx-target={!isNewPost ? '#update-time' : undefined}
                >
                  <input
                    class="my-8 block w-full rounded-sm border bg-transparent p-2 text-2xl ring-blue-700 focus:outline-none focus:ring-2 dark:border-gray-800 dark:ring-offset-gray-900"
                    type="text"
                    name="title"
                    value={post.title}
                    required="true"
                  />
                  <div class="grid grid-cols-2 gap-10">
                    <textarea
                      class="rounded-sm border bg-transparent p-4 ring-blue-700 ring-offset-4 focus:outline-none focus:ring-2 dark:border-gray-800 dark:ring-offset-gray-900"
                      name="body"
                      required="true"
                      hx-get="/admin/preview"
                      hx-target="#preview"
                      hx-trigger="keyup changed delay:500ms"
                    >
                      {elements.escapeHtml(post.body)}
                    </textarea>
                    <div
                      class="prose dark:prose-invert dark:prose-dark"
                      id="preview"
                    >
                      {md.render(post.body)}
                    </div>
                  </div>
                  <section class="mt-8 space-y-2">
                    <header class="font-semibold text-lg">Metadata</header>
                    <input
                      class="block w-full rounded-sm border bg-transparent p-2 ring-blue-700 focus:outline-none focus:ring-2 dark:border-gray-800 dark:ring-offset-gray-900"
                      type="text"
                      name="slug"
                      placeholder="Slug"
                      required="true"
                      value={post.slug === 'new' ? '' : post.slug}
                    />
                    <input
                      class="block w-full rounded-sm border bg-transparent p-2 ring-blue-700 focus:outline-none focus:ring-2 dark:border-gray-800 dark:ring-offset-gray-900"
                      name="longSlug"
                      readonly="true"
                      placeholder="Long Slug"
                      type="text"
                      value={post.longSlug}
                    />
                    <input
                      class="block w-full rounded-sm border bg-transparent p-2 ring-blue-700 focus:outline-none focus:ring-2 dark:border-gray-800 dark:ring-offset-gray-900"
                      name="excerpt"
                      placeholder="Excerpt"
                      type="text"
                      required="true"
                      value={post.excerpt}
                    />
                    <input
                      class="block w-full rounded-sm border bg-transparent p-2 ring-blue-700 focus:outline-none focus:ring-2 dark:border-gray-800 dark:ring-offset-gray-900"
                      type="text"
                      name="series"
                      placeholder="Series"
                      value={post.series ?? ''}
                    />
                    <input
                      type="checkbox"
                      name="published"
                      checked={post.published}
                    />
                  </section>
                  <footer class="flex justify-end mt-4 gap-2">
                    {!isNewPost ? (
                      <button
                        class="px-4 py-2 bg-red-400"
                        hx-confirm="Are you sure you want to delete this post?"
                        hx-delete={`/admin/${post.slug}`}
                      >
                        Delete
                      </button>
                    ) : null}
                    <button class="px-4 py-2 bg-brandBlue-500">Save</button>
                  </footer>
                </form>
              </BaseHtml>
            )
          },
          {
            params: t.Object({
              slug: t.String(),
            }),
          }
        )
        .post(
          '/:slug',
          async ({ set, body }) => {
            const isPublished = body.published === 'on'
            const longSlug = body.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '')

            await db.insert(posts).values({
              ...body,
              series: body.series !== '' ? body.series : null,
              longSlug,
              published: isPublished,
            })

            set.redirect = `/admin/${body.slug}`
          },
          {
            params: t.Object({
              slug: t.String(),
            }),
            body: t.Object({
              series: t.String(),
              slug: t.String(),
              title: t.String(),
              body: t.String(),
              published: t.Optional(t.Literal('on')),
              excerpt: t.String(),
              longSlug: t.Optional(t.String()),
            }),
          }
        )
        .patch(
          '/:slug',
          async ({ body }) => {
            const isPublished = body.published === 'on'
            const longSlug = body.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '')

            await db
              .update(posts)
              .set({
                ...body,
                series: body.series !== '' ? body.series : null,
                longSlug,
                published: isPublished,
              })
              .where(eq(posts.slug, body.slug))

            return new Intl.DateTimeFormat('sv-SE', {
              dateStyle: 'short',
              timeStyle: 'medium',
            }).format(new Date())
          },
          {
            params: t.Object({
              slug: t.String(),
            }),
            body: t.Object({
              series: t.String(),
              slug: t.String(),
              title: t.String(),
              body: t.String(),
              published: t.Optional(t.Literal('on')),
              excerpt: t.String(),
              longSlug: t.Optional(t.String()),
            }),
          }
        )
        .delete(
          '/:slug',
          async ({ params }) => {
            await db.delete(posts).where(eq(posts.slug, params.slug))

            return new Response(null, {
              headers: {
                'HX-Redirect': '/admin',
              },
            })
          },
          {
            params: t.Object({
              slug: t.String(),
            }),
          }
        )
        .get('/preview', async ({ query }) => md.render(query.body), {
          query: t.Object({
            body: t.String(),
          }),
        })
  )
}
