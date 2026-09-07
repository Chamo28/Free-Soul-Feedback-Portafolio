import { Routes, Route, Navigate } from "react-router-dom";
import { isAdminLoggedIn } from "./api.js";

import AdminLogin from "./pages/AdminLogin.jsx";
import Home from "./pages/Home.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import ProductForm from "./pages/ProductForm.jsx";
import CurationForm from "./pages/CurationForm.jsx";
import Results from "./pages/Results.jsx";
import Survey from "./pages/Survey.jsx";
import Curation from "./pages/Curation.jsx";
import ThankYou from "./pages/ThankYou.jsx";
import PurchaseOrdersList from "./pages/PurchaseOrdersList.jsx";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail.jsx";

function RequireAdmin({ children }) {
  if (!isAdminLoggedIn()) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <Home />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/curaduria"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/products/new"
        element={
          <RequireAdmin>
            <ProductForm />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/curaduria/new"
        element={
          <RequireAdmin>
            <CurationForm />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/results"
        element={
          <RequireAdmin>
            <Results />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/pedidos"
        element={
          <RequireAdmin>
            <PurchaseOrdersList />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/pedidos/:id"
        element={
          <RequireAdmin>
            <PurchaseOrderDetail />
          </RequireAdmin>
        }
      />

      <Route path="/survey/:productId" element={<Survey />} />
      <Route path="/survey/:productId/gracias" element={<ThankYou />} />

      <Route path="/curacion/:surveyId" element={<Curation />} />
      <Route path="/curacion/:surveyId/gracias" element={<ThankYou />} />

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
