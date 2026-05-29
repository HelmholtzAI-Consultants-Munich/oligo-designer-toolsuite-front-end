import FAQ from "./pages/Faq";
import Contact from "./pages/Contact";
import Pipelines from "./pages/Pipelines";
import Scrinshot from "./pages/Scrinshot";
import Runs from "./pages/Runs";
import Merfish from "./pages/Merfish";
import SeqFish from "./pages/SeqFish";
import OligoSeq from "./pages/OligoSeq";
import Login from "./pages/Login";
import RunDetail from "./pages/RunDetail";
import Terms from "./pages/terms";
import PrivacyPolicy from "./pages/privacy-policy";
import AdminApp from "./admin/AdminApp";
import DefaultLayout from "./components/layouts/DefaultLayout";
import FeedbackButton from "./components/feedback/FeedbackButton";
import NotFound from "./pages/404";
import { useAuth } from "./hooks/useAuth";
import {
    createBrowserRouter,
    Outlet,
    RouterProvider,
    ScrollRestoration,
    useParams,
} from "react-router";
import "./styles/theme.scss";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fontsource-variable/fustat";

function RunDetailWrapper() {
    const { runId } = useParams();
    return <RunDetail key={runId} />;
}

function RootLayout() {
    const auth = useAuth();

    return (
        <>
            {auth.authenticated && <FeedbackButton floating />}
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
    { path: "/terms", element: <Terms /> },
    { path: "/privacy-policy", element: <PrivacyPolicy /> },
    { path: "/pipelines", element: <Pipelines /> },
    { path: "/pipelines/scrinshot", element: <Scrinshot /> },
    { path: "/pipelines/merfish", element: <Merfish /> },
    { path: "/pipelines/seqfish", element: <SeqFish /> },
    { path: "/pipelines/oligoseq", element: <OligoSeq /> },
    { path: "/runs/:runId", element: <RunDetailWrapper /> },
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
        errorElement: <NotFound />,
    },
]);

function App() {
    return <RouterProvider router={router} />;
}

export default App;
