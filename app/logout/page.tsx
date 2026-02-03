import { logout } from '@/lib/actions/auth'

export default async function LogoutPage() {
  await logout()
  return null
}
