import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import DashboardLayout from '../pages/Dashboard/DashboardLayout';
import HomePage from '../pages/Home/HomePage';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ContactDetailPage from '../pages/Contact/ContactDetailPage';
import ChatPage from '../pages/Chat/ChatPage';
import ProjectsPage from '../pages/ProjectsPage';
import ProjectDetailPage from '../pages/Project/ProjectDetailPage';
import SuperAdminUsersPage from '../pages/SuperAdmin/SuperAdminUsersPage';
import ProtectedRoute from '../components/ProtectedRoute';

// 创建路由配置
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/super-admin/users',
    element: (
      <ProtectedRoute requireSuperAdmin>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <SuperAdminUsersPage />,
      },
    ],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'chat/:chatId',
        element: <ChatPage />,
      },
      {
        path: 'contact/:userId',
        element: <ContactDetailPage />,
      },
      {
        path: 'project/:projectId',
        element: <ProjectDetailPage />,
        children: [
          {
            index: true,
            element: <Navigate to="overview" replace />,
          },
          {
            path: 'overview',
            element: <></>,
          },
          {
            path: 'tasks',
            element: <Navigate to="in-progress" replace />,
          },
          {
            path: 'tasks/:taskView',
            element: <></>,
          },
          {
            path: 'tasks/:taskView/:taskId',
            element: <></>,
          },
          {
            path: 'bugs',
            element: <Navigate to="pending" replace />,
          },
          {
            path: 'bugs/:bugView',
            element: <></>,
          },
          {
            path: 'bugs/:bugView/:bugId',
            element: <></>,
          },
          {
            path: 'documents',
            element: <></>,
          },
          {
            path: 'ai',
            element: <></>,
          },
          {
            path: 'documents/:documentId',
            element: <></>,
          },
          {
            path: 'prototypes',
            element: <></>,
          },
          {
            path: 'repositories',
            element: <></>,
          },
          {
            path: '*',
            element: <Navigate to="overview" replace />,
          },
        ],
      },
      {
        path: 'contacts',
        element: <HomePage />,
      },
      {
        path: 'projects',
        element: <ProjectsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
