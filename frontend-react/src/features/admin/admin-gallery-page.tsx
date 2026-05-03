import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as galleryApi from '@/core/api/admin-gallery'
import type { GalleryImageResponse } from '@/core/api/models'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Upload, Trash2, Pencil, X, Check } from 'lucide-react'

export default function AdminGalleryPage() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: images, isLoading } = useQuery({
    queryKey: ['admin', 'gallery'],
    queryFn: galleryApi.listGallery,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => galleryApi.uploadGalleryImage(file, '', '', (images?.length ?? 0)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'gallery'] })
      toast.success('Image uploaded')
    },
    onError: () => toast.error('Upload failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: galleryApi.deleteGalleryImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'gallery'] })
      toast.success('Image deleted')
    },
    onError: () => toast.error('Delete failed'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; title: string; alt_text: string; sort_order: number }) =>
      galleryApi.updateGalleryImage(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'gallery'] })
      toast.success('Image updated')
    },
    onError: () => toast.error('Update failed'),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage landing page gallery images</p>
        </div>
        <Button onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending}>
          <Upload className="mr-2 h-4 w-4" />
          {uploadMutation.isPending ? 'Uploading...' : 'Upload Image'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadMutation.mutate(file)
            e.target.value = ''
          }}
        />
      </div>

      {!images?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No gallery images yet. Upload one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((img) => (
            <GalleryCard
              key={img.id}
              image={img}
              onDelete={() => deleteMutation.mutate(img.id)}
              onUpdate={(data) => updateMutation.mutate({ id: img.id, ...data })}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GalleryCard({ image, onDelete, onUpdate, deleting }: {
  image: GalleryImageResponse
  onDelete: () => void
  onUpdate: (data: { title: string; alt_text: string; sort_order: number }) => void
  deleting: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(image.title)
  const [altText, setAltText] = useState(image.alt_text)
  const [sortOrder, setSortOrder] = useState(image.sort_order)

  const save = () => {
    onUpdate({ title, alt_text: altText, sort_order: sortOrder })
    setEditing(false)
  }

  return (
    <Card className="overflow-hidden">
      <img
        src={image.image_url}
        alt={image.alt_text || image.title || 'Gallery image'}
        className="h-48 w-full object-cover"
      />
      <CardContent className="p-3">
        {editing ? (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Alt text</Label>
              <Input value={altText} onChange={(e) => setAltText(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Sort order</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="h-8 text-sm" />
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7" onClick={save}>
                <Check className="mr-1 h-3 w-3" /> Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(false)}>
                <X className="mr-1 h-3 w-3" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="truncate text-sm font-medium">{image.title || 'Untitled'}</p>
            <p className="truncate text-xs text-muted-foreground">{image.alt_text || 'No description'}</p>
            <div className="mt-2 flex gap-1">
              <Button size="sm" variant="outline" className="h-7" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-3 w-3" /> Edit
              </Button>
              <Button size="sm" variant="destructive" className="h-7" onClick={onDelete} disabled={deleting}>
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
