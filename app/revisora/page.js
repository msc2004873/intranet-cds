import { redirect } from 'next/navigation';

export default function RevisoraPage() {
  redirect('/api/serve-html?file=revisora');
}
