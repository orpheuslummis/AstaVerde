import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full flex justify-center items-center p-4 bg-primary text-white shadow-md gap-4">
      <div className="text-center">
        <Link href="/termsofservice" className="hover:underline">Terms of Service</Link>
      </div>
      <div className="text-center">
        <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
      </div>
    </footer>
  );
}