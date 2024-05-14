import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full flex justify-center items-center p-4 bg-primary text-white shadow-md gap-4">
      <div className="text-center">
        <Link href="/termsofservice">
          <a className="hover:underline">Terms of Service</a>
        </Link>
      </div>
      <div className="text-center">
        <Link href="/privacy">
          <a className="hover:underline">Privacy Policy</a>
        </Link>
      </div>
    </footer>
  );
}
