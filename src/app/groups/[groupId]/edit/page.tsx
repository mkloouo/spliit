import { EditGroup } from '@/app/groups/[groupId]/edit/edit-group'
import { env } from '@/lib/env'
import { getTranslations } from 'next-intl/server'

// Render at request time rather than caching, so the flag below reflects the
// environment the container was started with.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('Settings')

  return {
    title: t('title'),
  }
}

export default async function EditGroupPage() {
  return (
    <EditGroup
      enableReceiptExtract={
        env.ENABLE_RECEIPT_EXTRACT || env.NEXT_PUBLIC_ENABLE_RECEIPT_EXTRACT
      }
    />
  )
}
