import Link from "next/link";
import { requireOsSession } from "@/lib/os/session";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createPostAction } from "../actions";

export default async function NewPostPage() {
  await requireOsSession();
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/os/posts" className="text-sm text-orange hover:underline">← Posts</Link>
        <h1 className="text-2xl font-bold text-navy mt-2">New post</h1>
      </div>
      <form action={createPostAction} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="slug">URL slug</Label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-navy/50 font-mono">/blog/</span>
                <Input id="slug" name="slug" pattern="[a-z0-9\-/]+" required className="font-mono" />
              </div>
            </div>
            <div>
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea id="excerpt" name="excerpt" rows={3} maxLength={500} />
            </div>
            <div>
              <Label htmlFor="cover_image_url">Cover image URL</Label>
              <Input id="cover_image_url" name="cover_image_url" placeholder="/images/post-cover.jpg" className="mt-1" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Body (Markdown)</CardTitle></CardHeader>
          <CardBody>
            <Textarea name="body_md" rows={20} placeholder="# Heading&#10;&#10;Write your post in Markdown." required />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Publishing</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue="draft"
                className="mt-1 w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <Label htmlFor="scheduled_for">Scheduled for (only used if status is Scheduled)</Label>
              <Input id="scheduled_for" name="scheduled_for" type="datetime-local" className="mt-1" />
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg">Create post</Button>
        </div>
      </form>
    </div>
  );
}
