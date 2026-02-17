import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';

// Layout
import Layout from './components/Layout/Layout';
import AdminLayout from './components/Layout/AdminLayout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import BoothList from './pages/BoothList';
import BoothDetail from './pages/BoothDetail';
import Quiz from './pages/Quiz';
import Leaderboard from './pages/Leaderboard';
import Feedback from './pages/Feedback';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Landing from './pages/Landing';
import Programs from './pages/Programs';

// Admin Pages
import AdminDashboard from './pages/Admin/Dashboard';
import AdminUsers from './pages/Admin/Users';
import AdminBooths from './pages/Admin/Booths';
import AdminGallery from './pages/Admin/Gallery';
import AdminQuestions from './pages/Admin/Questions';
import AdminQuizResults from './pages/Admin/QuizResults';
import AdminQuizSettings from './pages/Admin/QuizSettings';
import AdminFeedback from './pages/Admin/Feedback';
import AdminNotifications from './pages/Admin/Notifications';
import AdminPrograms from './pages/Admin/Programs';

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/home" />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
        
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Public Routes with Layout */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="home" element={<Home />} />
            <Route path="booths" element={<BoothList />} />
            <Route path="booths/:id" element={<BoothDetail />} />
            <Route path="quiz" element={<Quiz />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="programs" element={<Programs />} />
            <Route path="profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute adminOnly>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="booths" element={<AdminBooths />} />
            <Route path="gallery" element={<AdminGallery />} />
            <Route path="questions" element={<AdminQuestions />} />
            <Route path="quiz-results" element={<AdminQuizResults />} />
            <Route path="quiz-settings" element={<AdminQuizSettings />} />
            <Route path="feedback" element={<AdminFeedback />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="programs" element={<AdminPrograms />} />
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
