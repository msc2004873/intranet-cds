import { redirect } from 'next/navigation';

export default function CajeraPage() {
  redirect('/api/serve-html?file=cajera');
}
