// Main application entry point
const App = () => {
  const [initialized, setInitialized] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [activeView, setActiveView] = React.useState('employee'); // 'employee' or 'admin'
  
  // Check if the app is initialized on mount
  React.useEffect(() => {
    checkInitialization();
  }, []);
  
  // Check if the PIN is set
  const checkInitialization = async () => {
    try {
      const pinHash = await dbService.getConfig('pinHash');
      setInitialized(!!pinHash);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };
  
  // Handle completion of initial setup
  const handleSetupComplete = () => {
    setInitialized(true);
    setIsAdmin(true);
  };
  
  // Handle admin login
  const handleAdminLogin = () => {
    setIsAdmin(true);
  };
  
  // Handle admin logout
  const handleAdminLogout = () => {
    setIsAdmin(false);
  };
  
  // Handle view toggle
  const toggleView = () => {
    setActiveView(activeView === 'employee' ? 'admin' : 'employee');
  };
  
  // Render loading state
  if (loading) {
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
    return <InitialSetup onComplete={handleSetupComplete} />;
  }
  
  // Render the admin panel if admin is logged in
  if (isAdmin) {
    return <AdminPanel onLogout={handleAdminLogout} />;
  }
  
  // Render the main application
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

// Render the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  ReactDOM.render(<App />, root);
  console.log('App rendered to DOM');
}); 