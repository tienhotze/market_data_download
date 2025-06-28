"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

interface NavigationProps {
  showBack?: boolean;
  backUrl?: string;
  title?: string;
}

export function Navigation({
  showBack = true,
  backUrl,
  title,
}: NavigationProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  const handleHome = () => {
    router.push("/");
  };

  return (
    <div className="flex items-center justify-between mb-6 p-4 bg-background border-b">
      <div className="flex items-center gap-4">
        {showBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleHome}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Home
        </Button>
      </div>
      {title && (
        <h1 className="text-xl font-semibold text-center flex-1">{title}</h1>
      )}
      <div className="w-24"></div> {/* Spacer for centering title */}
    </div>
  );
}
