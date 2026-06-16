import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { TopBar } from '@/components/layout/TopBar';
import { SimulationBar } from '@/components/sim/SimulationBar';
import { AuthProvider, useAuth } from '@/context/AuthProvider';
import { DatasetProvider, useDatasetCtx } from '@/context/DatasetProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { BonusView } from '@/features/bonus/BonusView';
import { CockpitView } from '@/features/cockpit/CockpitView';
import { PivotView } from '@/features/pivot/PivotView';
import { SimulationsView } from '@/features/simulations/SimulationsView';
import { TimelineView } from '@/features/timeline/TimelineView';

const LOGIN_PATH = '/login';
const HOME_PATH = '/';

function ErrorWatcher() {
  const { error } = useDatasetCtx();
  useEffect(() => {
    if (error) toast.error('Error', { description: error });
  }, [error]);
  return null;
}

function Dashboard() {
  const { isAdmin } = useAuth();
  return (
    <AppShell>
      <div className="space-y-5">
        <TopBar />
        <SimulationBar />
        <Tabs defaultValue="cockpit" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cockpit">Cockpit</TabsTrigger>
            <TabsTrigger value="pivot">Pivote</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="simulations">Simulaciones</TabsTrigger>
            {isAdmin && <TabsTrigger value="bonus">Bonus</TabsTrigger>}
          </TabsList>
          <TabsContent value="cockpit" className="mt-2">
            <CockpitView />
          </TabsContent>
          <TabsContent value="pivot" className="mt-2">
            <PivotView />
          </TabsContent>
          <TabsContent value="timeline" className="mt-2">
            <TimelineView />
          </TabsContent>
          <TabsContent value="simulations" className="mt-2">
            <SimulationsView />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="bonus" className="mt-2">
              <BonusView />
            </TabsContent>
          )}
        </Tabs>
      </div>
      <ErrorWatcher />
    </AppShell>
  );
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

/**
 * Forces the URL to match auth state:
 *   logged-in   → "/"
 *   logged-out  → "/login"
 * Runs on every auth/path change and on history popstate (back/forward).
 */
function useCanonicalAuthPath(authed: boolean, ready: boolean) {
  useEffect(() => {
    if (!ready) return;

    const target = authed ? HOME_PATH : LOGIN_PATH;
    function reconcile() {
      const current = window.location.pathname;
      const onTarget =
        target === HOME_PATH
          ? current === HOME_PATH
          : current === LOGIN_PATH;
      if (!onTarget) {
        window.history.replaceState(null, '', target + window.location.search + window.location.hash);
      }
    }
    reconcile();
    window.addEventListener('popstate', reconcile);
    return () => window.removeEventListener('popstate', reconcile);
  }, [authed, ready]);
}

function Root() {
  const { loading, user } = useAuth();
  useCanonicalAuthPath(!!user, !loading);

  if (loading) return <Splash />;
  if (!user) return <LoginPage />;
  return (
    <DatasetProvider>
      <Dashboard />
    </DatasetProvider>
  );
}

export default function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <AuthProvider>
        <Root />
        <Toaster />
      </AuthProvider>
    </TooltipProvider>
  );
}
