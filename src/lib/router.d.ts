import * as React from "react";

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export interface LocationValue {
  pathname: string;
  search: string;
  hash: string;
}

export function BrowserRouter(props: { children?: React.ReactNode }): React.ReactElement;
export const Router: typeof BrowserRouter;
export function Routes(props: { children?: React.ReactNode }): React.ReactElement | null;
export function Route(props: { path: string; element: React.ReactNode }): React.ReactElement | null;
export function Link(props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; children?: React.ReactNode }): React.ReactElement;
export function Navigate(props: { to: string; replace?: boolean; state?: unknown }): React.ReactElement | null;
export function useNavigate(): (to: string | number, options?: NavigateOptions) => void;
export function useLocation(): LocationValue;
export function useNavigationType(): "POP" | "PUSH" | "REPLACE" | string;
export function useParams<T extends Record<string, string> = Record<string, string>>(): T;
export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string>, options?: NavigateOptions) => void];
