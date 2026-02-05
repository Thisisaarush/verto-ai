"use client"

import { PricingTable } from "../components/pricing-table"
import { MobileHeader } from "@/modules/dashboard/ui/components/mobile-header"

export const BillingView = () => {
  return (
    <div className="flex h-full flex-col bg-muted overflow-auto">
      <MobileHeader title="Plans & Billing" />
      <div className="mx-auto w-full max-w-screen-md p-8">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl">Plans & Billing</h1>
          <p>Choose the plan that best fits your needs.</p>
        </div>

        <div className="mt-8">
          <PricingTable />
        </div>
      </div>
    </div>
  )
}
