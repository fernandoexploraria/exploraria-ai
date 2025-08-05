import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

interface PageNavigationProps {
  breadcrumbs: Array<{
    label: string;
    href?: string;
  }>;
  backLink?: {
    href: string;
    label: string;
  };
}

export const PageNavigation: React.FC<PageNavigationProps> = ({
  breadcrumbs,
  backLink
}) => {
  return (
    <div className="bg-background border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Breadcrumbs */}
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((breadcrumb, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    {breadcrumb.href ? (
                      <BreadcrumbLink asChild>
                        <Link to={breadcrumb.href}>{breadcrumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Back Link */}
          {backLink && (
            <Button variant="outline" size="sm" asChild>
              <Link to={backLink.href} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                {backLink.label}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};