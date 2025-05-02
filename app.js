// Main application entry point
const App = () => {
  const [initialized, setInitialized] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [activeView, setActiveView] = React.useState('employee'); // 'employee' or 'admin'
  
  console.log("App component rendering");
  
  // Check if the app is initialized on mount
  React.useEffect(() => {
    console.log("Running initialization effect");
    checkInitialization();
  }, []);
  
  // Check if the PIN is set
  const checkInitialization = async () => {
    try {
      console.log("Checking if PIN is set...");
      const pinHash = await dbService.getConfig('pinHash');
      console.log("PIN hash retrieved:", !!pinHash);
      setInitialized(!!pinHash);
      setLoading(false);
    } catch (err) {
      console.error("Error checking initialization:", err);
      setLoading(false);
    }
  };
  
  // Handle completion of initial setup
  const handleSetupComplete = () => {
    console.log("Setup complete");
    setInitialized(true);
    setIsAdmin(true);
  };
  
  // Handle admin login
  const handleAdminLogin = () => {
    console.log("Admin logged in");
    setIsAdmin(true);
  };
  
  // Handle admin logout
  const handleAdminLogout = () => {
    console.log("Admin logged out");
    setIsAdmin(false);
  };
  
  // Handle view toggle
  const toggleView = () => {
    const newView = activeView === 'employee' ? 'admin' : 'employee';
    console.log("Toggling view to:", newView);
    setActiveView(newView);
  };
  
  // Render loading state
  if (loading) {
    console.log("Rendering loading state");
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    );
  }
  
  // Render initial setup if not initialized
  if (!initialized) {
    console.log("Rendering initial setup");
    return <InitialSetup onComplete={handleSetupComplete} />;
  }
  
  // Render the admin panel if admin is logged in
  if (isAdmin) {
    console.log("Rendering admin panel");
    return <AdminPanel onLogout={handleAdminLogout} />;
  }
  
  // Render the main application
  console.log("Rendering main application view:", activeView);
  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="text-right mb-4">
        <button
          onClick={toggleView}
          className="text-blue-500 hover:text-blue-700 text-sm"
        >
          {activeView === 'employee' ? 'Admin' : 'Medarbetare'}
        </button>
      </div>
      
      {activeView === 'employee' ? (
        <EmployeeForm />
      ) : (
        <AdminLogin onLogin={handleAdminLogin} />
      )}
    </div>
  );
};

// Make App available globally
window.App = App;

console.log("App.js loaded and defined App component");

// Don't render here - we'll render from index.html to ensure all scripts are loaded
// This avoids double rendering which can cause issues
/* 
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  ReactDOM.render(<App />, root);
  console.log('App rendered to DOM');
}); 
*/ 