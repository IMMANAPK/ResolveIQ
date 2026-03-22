import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSettings, useUpdateSettings, useTestAi, useTestEmail, useTestCloudinary } from "@/hooks/useSettings";
import { Loader2 } from "lucide-react";

export default function SystemSettings() {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const testAiMutation = useTestAi();
  const testEmailMutation = useTestEmail();
  const testCloudinaryMutation = useTestCloudinary();

  const [form, setForm] = useState<Record<string, any>>({});
  const [testEmailAddr, setTestEmailAddr] = useState<string>("");
  // Only populate the form from the server on the very first load.
  // If we re-ran on every refetch (e.g. after saving AI config), it would
  // overwrite unsaved SMTP fields the user has already typed — and vice versa.
  const formInitialized = useRef(false);

  useEffect(() => {
    if (settings && !formInitialized.current) {
      setForm(settings);
      formInitialized.current = true;
    }
  }, [settings]);

  if (isLoading) return <div className="flex p-20 justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;

  const handleUpdate = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async (keys: string[]) => {
    const payload: Record<string, any> = {};
    for (const k of keys) {
      if (k === 'ai.routingConfidenceThreshold' || k === 'email.smtpPort') {
        payload[k] = parseFloat(form[k]) || 0;
      } else {
        payload[k] = form[k];
      }
    }
    
    try {
      await updateMutation.mutateAsync(payload);
      toast.success("Settings saved successfully!");
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    }
  };

  const handleTestAi = async () => {
    try {
      const result = await testAiMutation.mutateAsync();
      if (result.success) {
        toast.success(`Success (${result.timeMs}ms)! Summary: ${result.summary}`);
      } else {
        toast.error(`Failed (${result.timeMs}ms): ${result.error}`);
      }
    } catch (err: any) {
      toast.error(`Test failed: ${err.message}`);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddr) return toast.error("Enter test receiver email");
    try {
      const result = await testEmailMutation.mutateAsync({ to: testEmailAddr });
      if (result.success) {
        toast.success(`Email sent successfully in ${result.timeMs}ms!`);
      } else {
        toast.error(`Failed to send (${result.timeMs}ms): ${result.error}`);
      }
    } catch (err: any) {
      toast.error(`Test failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground mt-2">Manage AI behaviors and global email dispatchers. To test, save your settings first.</p>
      </div>

      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ai">AI Configuration</TabsTrigger>
          <TabsTrigger value="email">Email Configuration</TabsTrigger>
          <TabsTrigger value="cloudinary">Cloudinary</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-6">
          <div className="card-surface p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Groq Integration</h2>
            <div className="space-y-2">
              <Label>Groq API Key</Label>
              <Input type="password" value={form['ai.groqApiKey'] || ''} onChange={(e) => handleUpdate('ai.groqApiKey', e.target.value)} placeholder="gsk_... or reads from ENV" />
            </div>
            <div className="space-y-2">
              <Label>Routing Confidence Threshold (0.0 - 1.0)</Label>
              <Input type="number" step="0.1" value={form['ai.routingConfidenceThreshold'] || '0.7'} onChange={(e) => handleUpdate('ai.routingConfidenceThreshold', e.target.value)} />
            </div>
            <div className="pt-4 flex items-center justify-between">
              <Button onClick={() => handleSave(['ai.groqApiKey', 'ai.routingConfidenceThreshold'])} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save AI Settings
              </Button>
              <Button variant="outline" onClick={handleTestAi} disabled={testAiMutation.isPending}>
                {testAiMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test AI Connection
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <div className="card-surface p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">SMTP Transporter</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input value={form['email.smtpHost'] || ''} onChange={(e) => handleUpdate('email.smtpHost', e.target.value)} placeholder="127.0.0.1 or overrides ENV" />
              </div>
              <div className="space-y-2">
                <Label>SMTP Port</Label>
                <Input type="number" value={form['email.smtpPort'] || ''} onChange={(e) => handleUpdate('email.smtpPort', e.target.value)} placeholder="1025" />
              </div>
              <div className="space-y-2">
                <Label>SMTP User</Label>
                <Input value={form['email.smtpUser'] || ''} onChange={(e) => handleUpdate('email.smtpUser', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>SMTP Password</Label>
                <Input type="password" value={form['email.smtpPass'] || ''} onChange={(e) => handleUpdate('email.smtpPass', e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Default "From" Address</Label>
                <Input value={form['email.fromAddress'] || ''} onChange={(e) => handleUpdate('email.fromAddress', e.target.value)} placeholder="noreply@resolveiq.com" />
              </div>
            </div>
            <div className="pt-4 flex items-center justify-between">
              <Button onClick={() => handleSave(['email.smtpHost', 'email.smtpPort', 'email.smtpUser', 'email.smtpPass', 'email.fromAddress'])} disabled={updateMutation.isPending}>
                Save Email Settings
              </Button>
              <div className="flex gap-2 items-center">
                <Input placeholder="Test Receiver Email" value={testEmailAddr} onChange={e => setTestEmailAddr(e.target.value)} className="w-[200px]" />
                <Button variant="outline" onClick={handleTestEmail} disabled={testEmailMutation.isPending}>
                  {testEmailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Test Email
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="cloudinary" className="space-y-6">
          <div className="card-surface p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Cloudinary (File Attachments)</h2>
            <div className="space-y-2">
              <Label>Cloud Name</Label>
              <Input value={form['cloudinary.cloudName'] || ''} onChange={(e) => handleUpdate('cloudinary.cloudName', e.target.value)} placeholder="your-cloud-name or reads from ENV" />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input type="password" value={form['cloudinary.apiKey'] || ''} onChange={(e) => handleUpdate('cloudinary.apiKey', e.target.value)} placeholder="123456789012345" />
            </div>
            <div className="space-y-2">
              <Label>API Secret</Label>
              <Input type="password" value={form['cloudinary.apiSecret'] || ''} onChange={(e) => handleUpdate('cloudinary.apiSecret', e.target.value)} placeholder="••••••••••••••••••••••••••" />
            </div>
            <div className="pt-4 flex items-center justify-between">
              <Button onClick={() => handleSave(['cloudinary.cloudName', 'cloudinary.apiKey', 'cloudinary.apiSecret'])} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Cloudinary Settings
              </Button>
              <Button variant="outline" onClick={async () => {
                try {
                  const result = await testCloudinaryMutation.mutateAsync();
                  if (result.success) toast.success(`Cloudinary connected! (${result.timeMs}ms)`);
                  else toast.error(`Failed: ${result.error}`);
                } catch (err: any) { toast.error(`Test failed: ${err.message}`); }
              }} disabled={testCloudinaryMutation.isPending}>
                {testCloudinaryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
