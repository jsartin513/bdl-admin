import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to schedules page as the main landing page
  redirect('/schedules')
}
