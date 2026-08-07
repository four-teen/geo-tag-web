import "@/styles/globals.css";
import "react-toastify/dist/ReactToastify.css";

import { ToastContainer } from "react-toastify";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { installStaffPageContext, logStaffPageView } from "../utils/activity";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => installStaffPageContext(), []);

  useEffect(() => {
    const recordPageView = (url: string) => logStaffPageView(url);

    if (router.isReady) {
      recordPageView(router.asPath);
    }

    router.events.on("routeChangeComplete", recordPageView);
    return () => router.events.off("routeChangeComplete", recordPageView);
  }, [router]);

  return (
    <>
      <Component {...pageProps} />
      <ToastContainer
        position="top-right"
        autoClose={3500}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  );
}
