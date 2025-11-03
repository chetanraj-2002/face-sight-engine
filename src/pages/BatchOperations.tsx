import { BulkUserImport, BatchImageUpload } from '@/components/batch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Image } from 'lucide-react';

export default function BatchOperations() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Batch Operations</h1>
        <p className="text-muted-foreground">
          Perform bulk operations on users and images
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            User Import
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-2">
            <Image className="h-4 w-4" />
            Image Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <BulkUserImport />
        </TabsContent>

        <TabsContent value="images">
          <BatchImageUpload />
        </TabsContent>
      </Tabs>
    </div>
  );
}
