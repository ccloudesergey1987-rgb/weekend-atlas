import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AppLayout } from './AppLayout'
import { HomeScreen } from '../screens/HomeScreen/HomeScreen'
import { RouteIndexRedirect, RouteScreen } from '../screens/RouteScreen/RouteScreen'
import { PlacesScreen } from '../screens/PlacesScreen/PlacesScreen'
import { BudgetScreen } from '../screens/BudgetScreen/BudgetScreen'
import { FavoritesScreen } from '../screens/FavoritesScreen/FavoritesScreen'

/** Each screen opens from the top, not at the previous screen's scroll position. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

// HashRouter: GitHub Pages has no server-side routing, so paths live after «#».
export function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route index element={<HomeScreen />} />
        <Route element={<AppLayout />}>
          <Route path="route" element={<RouteIndexRedirect />} />
          <Route path="route/:day" element={<RouteScreen />} />
          <Route path="places" element={<PlacesScreen />} />
          <Route path="budget" element={<BudgetScreen />} />
          <Route path="favorites" element={<FavoritesScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
