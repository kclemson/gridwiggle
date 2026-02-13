const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-2 text-5xl font-bold text-foreground">404</h1>
        <p className="mb-1 text-lg font-medium text-foreground">GridWiggle</p>
        <p className="mb-6 text-muted-foreground">This page doesn't exist.</p>
        <a href="/" className="text-primary underline hover:text-primary/80">
          Back to collage maker
        </a>
      </div>
    </div>
  );
};

export default NotFound;
