import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const RouterContext = createContext(null);
const ParamsContext = createContext({});

function currentLocation() {
  return {
    pathname: window.location.pathname || "/",
    search: window.location.search || "",
    hash: window.location.hash || "",
  };
}

export function BrowserRouter({ children }) {
  const [location, setLocation] = useState(currentLocation);
  const [navigationType, setNavigationType] = useState("POP");

  useEffect(() => {
    const onPopState = () => {
      setNavigationType("POP");
      setLocation(currentLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (to, options = {}) => {
    if (typeof to === "number") {
      window.history.go(to);
      return;
    }
    if (typeof to !== "string" || !to.startsWith("/")) throw new Error("Only absolute in-application paths are allowed.");
    const url = new URL(to, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error("Cross-origin navigation is not allowed.");
    if (options.replace) window.history.replaceState(options.state || null, "", `${url.pathname}${url.search}${url.hash}`);
    else window.history.pushState(options.state || null, "", `${url.pathname}${url.search}${url.hash}`);
    setNavigationType(options.replace ? "REPLACE" : "PUSH");
    setLocation(currentLocation());
  };

  const value = useMemo(() => ({ location, navigate, navigationType }), [location, navigationType]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export const Router = BrowserRouter;

export function useLocation() {
  const context = useContext(RouterContext);
  if (!context) throw new Error("useLocation must be used inside BrowserRouter");
  return context.location;
}

export function useNavigate() {
  const context = useContext(RouterContext);
  if (!context) throw new Error("useNavigate must be used inside BrowserRouter");
  return context.navigate;
}

export function useNavigationType() {
  const context = useContext(RouterContext);
  return context?.navigationType || "POP";
}

export function useParams() {
  return useContext(ParamsContext);
}

export function useSearchParams() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const setParams = (next, options = {}) => {
    const value = next instanceof URLSearchParams ? next : new URLSearchParams(next);
    navigate(`${window.location.pathname}?${value.toString()}${window.location.hash}`, options);
  };
  return [params, setParams];
}

export function Link({ to, onClick, target, children, ...props }) {
  const navigate = useNavigate();
  const href = typeof to === "string" ? to : "/";
  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  };
  return <a href={href} target={target} onClick={handleClick} {...props}>{children}</a>;
}

export function Navigate({ to, replace = false, state }) {
  const navigate = useNavigate();
  const hasNavigated = useRef(false);
  useEffect(() => {
    if (!hasNavigated.current) {
      hasNavigated.current = true;
      navigate(to, { replace, state });
    }
  }, [navigate, replace, state, to]);
  return null;
}

export function Route() {
  return null;
}

export function Routes({ children }) {
  const location = useLocation();
  const routes = React.Children.toArray(children);
  for (const route of routes) {
    if (!React.isValidElement(route)) continue;
    const match = matchPath(route.props.path, location.pathname);
    if (match) return <ParamsContext.Provider value={match.params}>{route.props.element}</ParamsContext.Provider>;
  }
  return null;
}

function matchPath(pattern, pathname) {
  if (!pattern) return null;
  if (pattern === "*") return { params: {} };
  const normalize = (value) => value !== "/" ? value.replace(/\/+$/, "") : value;
  const patternParts = normalize(pattern).split("/").filter(Boolean);
  const pathParts = normalize(pathname).split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected.startsWith(":")) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return null;
  }
  return { params };
}
