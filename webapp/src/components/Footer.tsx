import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full flex justify-center items-center p-4 shadow-md">
      <div className="text-center">
        <Link href="/terms" className="hover:underline">
          Terms of service
        </Link>
      </div>
    </footer>
  );
}
