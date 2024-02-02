import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full flex justify-center items-center p-4 shadow-md gap-4">
      <div className="text-center">
        <Link href="/terms" className="hover:underline">
          Terms of service
        </Link>
      </div>
      <div className="text-center">
        <Link href="/privacy" className="hover:underline">
          Privacy policy
        </Link>
      </div>
    </footer>
  );
}
