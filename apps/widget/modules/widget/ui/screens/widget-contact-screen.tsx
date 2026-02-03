"use client"

import z from "zod"
import WidgetHeader from "../components/widget-header"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { useAtomValue, useSetAtom } from "jotai"
import {
  contactSessionIdAtomFamily,
  organizationIdAtom,
  screenAtom,
} from "../../atoms/widget-atoms"
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
} from "lucide-react"
import { useState } from "react"

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
})

export const WidgetContactScreen = () => {
  const setScreen = useSetAtom(screenAtom)
  const organizationId = useAtomValue(organizationIdAtom)
  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId || ""),
  )
  const [isSubmitted, setIsSubmitted] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "",
    },
  })

  const submitContactForm = useMutation(api.public.contact.submit)

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!organizationId) return

    try {
      await submitContactForm({
        ...values,
        organizationId,
        contactSessionId: contactSessionId || undefined,
      })
      setIsSubmitted(true)
    } catch (error) {
      console.error("Failed to submit contact form:", error)
    }
  }

  if (isSubmitted) {
    return (
      <>
        <WidgetHeader className="flex items-center gap-x-2">
          <Button
            size="icon"
            variant="transparent"
            onClick={() => setScreen("selection")}
          >
            <ArrowLeftIcon className="size-5" />
          </Button>
          <p className="font-medium">Contact Us</p>
        </WidgetHeader>
        <div className="flex flex-1 flex-col items-center justify-center gap-y-4 p-6 text-center">
          <CheckCircleIcon className="size-16 text-green-500" />
          <h3 className="text-xl font-semibold">Message Sent!</h3>
          <p className="text-sm text-muted-foreground">
            Thank you for reaching out. We&apos;ll get back to you as soon as
            possible.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => setScreen("selection")}
          >
            Back to Home
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <WidgetHeader className="flex items-center gap-x-2">
        <Button
          size="icon"
          variant="transparent"
          onClick={() => setScreen("selection")}
        >
          <ArrowLeftIcon className="size-5" />
        </Button>
        <p className="font-medium">Contact Us</p>
      </WidgetHeader>

      <div className="flex-1 overflow-y-auto">
        <Form {...form}>
          <form
            className="flex flex-col gap-y-4 p-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <p className="text-sm text-muted-foreground">
              Have a question or need help? Fill out the form below and
              we&apos;ll get back to you.
            </p>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-10 bg-background pl-10"
                        placeholder="Your name"
                        type="text"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MailIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-10 bg-background pl-10"
                        placeholder="your@email.com"
                        type="email"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">
                    Phone{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <PhoneIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-10 bg-background pl-10"
                        placeholder="+1 (555) 000-0000"
                        type="tel"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Message</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[100px] resize-none bg-background"
                      placeholder="How can we help you?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="mt-2"
              disabled={form.formState.isSubmitting}
              size="lg"
              type="submit"
            >
              {form.formState.isSubmitting ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </Form>
      </div>
    </>
  )
}
