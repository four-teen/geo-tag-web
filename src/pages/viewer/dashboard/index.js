import Head from "next/head";
import { useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../layouts";
import { Auth } from "../../api/auth";

export default function ViewerDashboard() {
  const router = useRouter();

  useEffect(() => {
    const guard = async () => {
      const auth = await Auth(router?.pathname);
      if (auth !== router?.pathname) {
        router.push({ pathname: auth });
      }
    };
    guard();
  }, [router]);

  return (
    <Layout>
      <Head>
        <title>Viewer Dashboard</title>
      </Head>
      <main className="p-6">
        <h1 className="text-2xl font-semibold text-slate-800">Viewer Dashboard</h1>
        <p className="text-slate-500 mt-1">Read-only access to geo-tagging and account data summaries.</p>
      </main>
    </Layout>
  );
}

