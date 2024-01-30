import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full flex justify-center items-center bg-primary p-4 shadow-md">
      <div className="text-center">
        <Link href="/terms" className="text-white hover:underline">
          Terms of Use
        </Link>
      </div>
    </footer>
  );
}
