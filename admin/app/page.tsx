import Link from 'next/link'
import { Lightbulb, Images, Send, Hourglass, Repeat2, Layers, LayoutDashboard, Palette, VideoIcon, Film, Scissors, Clapperboard, Package, LayoutList } from 'lucide-react'

const groups = [
  {
    label: 'Task Creation',
    pages: [
      {
        href: '/idea-to-task',
        icon: Lightbulb,
        title: 'Idea to Task',
        description: 'Build tasks from ideas paired with prompts',
      },
      {
        href: '/task-to-task',
        icon: Repeat2,
        title: 'Task to Task',
        description: 'Build tasks from the results of other tasks',
      },
    ],
  },
  {
    label: 'Jobs',
    pages: [
      {
        href: '/submit',
        icon: Send,
        title: 'Submit Job',
        description: 'Submit tasks to the server in batches',
      },
      {
        href: '/jobs',
        icon: Hourglass,
        title: 'Jobs in progress',
        description: 'Active jobs without a result yet',
      },
    ],
  },
  {
    label: 'Results',
    pages: [
      {
        href: '/task-sorter',
        icon: Images,
        title: 'Photo Review',
        description: 'Browse and sort results by product',
      },
      {
        href: '/product-stage',
        icon: Layers,
        title: 'Product Stage',
        description: 'Assign a stage to a product from its photo',
      },
      {
        href: '/product-manager',
        icon: LayoutDashboard,
        title: 'Product Manager',
        description: 'Cool tasks by product and prompt group',
      },
      {
        href: '/variant-colors',
        icon: Palette,
        title: 'Variant Colors',
        description: 'Assign colors to variants that have none',
      },
      {
        href: '/products',
        icon: Package,
        title: 'Approve Products',
        description: 'Approve products with sizes and previews',
      },
      {
        href: '/product-review',
        icon: Package,
        title: 'Product Review',
        description: 'Update the review field on products',
      },
      {
        href: '/product-categories',
        icon: Package,
        title: 'Product Categories',
        description: 'Manually check and fix product categories',
      },
    ],
  },
  {
    label: 'Video',
    pages: [
      {
        href: '/products-to-video',
        icon: VideoIcon,
        title: 'Products to Video',
        description: 'Create videos from variant photos',
      },
      {
        href: '/task-to-video',
        icon: Clapperboard,
        title: 'Task to Video',
        description: 'Create videos from task results',
      },
      {
        href: '/video-review',
        icon: Film,
        title: 'Video Review',
        description: 'Browse and review generated videos',
      },
      {
        href: '/video-builder',
        icon: Scissors,
        title: 'Video Builder',
        description: 'Cut, assemble and submit video compilations by product',
      },
      {
        href: '/video-combine',
        icon: Film,
        title: 'Video Combine',
        description: 'Randomly pick and stitch videos by category',
      },
      {
        href: '/video-by-product',
        icon: LayoutList,
        title: 'Video by Product',
        description: 'Videos by product, grouped by prompt and source',
      },
    ],
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold mb-2">Neon Content Admin</h1>
      <p className="text-muted-foreground text-sm mb-10">Select a section</p>
      <div className="flex flex-col gap-6 w-full max-w-xl">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              {group.label}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {group.pages.map(({ href, icon: Icon, title, description }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col gap-3 p-6 rounded-xl border bg-card hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Icon className="w-6 h-6 text-primary" />
                  <div>
                    <div className="font-medium">{title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
