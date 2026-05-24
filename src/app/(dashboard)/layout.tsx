import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 flex-1">{children}</main>
      <footer className="bg-white border-t border-gray-200 mt-8 w-full">
        <div className="mx-auto max-w-6xl px-4 py-6 space-y-2">
          <p className="text-base font-semibold text-gray-900">
            Engineered by{" "}
            <a href="https://zigao.wang" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Zigao Wang</a>.
          </p>
          <p className="text-xs text-gray-400">tally · Version 0.1.0-beta · Developed for YK Pao School</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Copyright © 2026 Zigao Wang. All rights reserved. This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the author be liable for any claim, damages, or other liability arising from the use of this software.
          </p>
          <p className="text-xs text-gray-400">
            The source code is publicly available on{" "}
            <a href="https://github.com/ZigaoWang/tally" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">GitHub</a>
            . For technical inquiries, please contact{" "}
            <a href="mailto:a@zigao.wang" className="underline hover:text-gray-700">a@zigao.wang</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
