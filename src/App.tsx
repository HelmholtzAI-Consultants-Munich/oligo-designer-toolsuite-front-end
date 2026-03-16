import FAQ from "./pages/faq";
import Contact from "./pages/contact";
import Pipelines from "./pages/pipelines";
import Scrinshot from "./pages/scrinshot";
import Runs from "./pages/runs";
import Merfish from "./pages/merfish";
import SeqFish from "./pages/seqfish";
import OligoSeq from "./pages/oligoseq";
import {
    createBrowserRouter,
    Outlet,
    RouterProvider,
    ScrollRestoration,
} from "react-router";
import "./styles/theme.scss";
import "./styles/utils.scss";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fontsource-variable/fustat";

import Login from "./pages/login";
import RunDetail from "./pages/rundetail";
import AdminApp from "./admin/AdminApp";
import DefaultLayout from "./components/layouts/DefaultLayout";
import FeedbackButton from "./components/feedback/FeedbackButton";
import { useAuth } from "./modules/useAuth";

function RootLayout() {
    const { user } = useAuth();

    return (
        <>
            {user && <FeedbackButton floating />}
            <Outlet />
            <ScrollRestoration />
        </>
    );
}

const defaultLayoutRoutes = [
    { path: "/login", element: <Login /> },
    { path: "/runs", element: <Runs /> },
    { path: "/", element: <Pipelines /> },
    { path: "/faq", element: <FAQ /> },
    { path: "/contact", element: <Contact /> },
    { path: "/pipelines", element: <Pipelines /> },
    { path: "/pipelines/scrinshot", element: <Scrinshot /> },
    { path: "/pipelines/merfish", element: <Merfish /> },
    { path: "/pipelines/seqfish", element: <SeqFish /> },
    { path: "/pipelines/oligoSeq", element: <OligoSeq /> },
    { path: "/runs/:runId", element: <RunDetail /> },
];

const router = createBrowserRouter([
    {
        element: <RootLayout />,
        children: [
            { path: "/admin/*", element: <AdminApp /> },
            {
                element: <DefaultLayout />,
                children: defaultLayoutRoutes,
            },
        ],
    },
]);

function App() {
    return <RouterProvider router={router} />;
}

export default App;
