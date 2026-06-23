import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateDemand, useListCategories, useListNeighborhoods } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Megaphone, MapPin, Camera, Loader2 } from "lucide-react";

const demandSchema = z.object({
  title: z.string().min(5, "O título deve ter pelo menos 5 caracteres"),
  description: z.string().min(10, "Detalhe melhor o problema (mínimo 10 caracteres)"),
  categoryId: z.coerce.number().min(1, "Selecione uma categoria"),
  neighborhoodId: z.coerce.number().min(1, "Selecione um bairro"),
  address: z.string().min(5, "Informe o endereço ou referência"),
  photoUrl: z.string().optional(),
});

export default function DemandCreate() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const createMutation = useCreateDemand();
  const { data: categories } = useListCategories();
  const { data: neighborhoods } = useListNeighborhoods();

  // Redirect if not logged in
  if (isAuthenticated === false) {
    setLocation("/login");
    return null;
  }

  const form = useForm<z.infer<typeof demandSchema>>({
    resolver: zodResolver(demandSchema),
    defaultValues: {
      title: "",
      description: "",
      address: "",
      photoUrl: "",
    },
  });

  const onSubmit = (data: z.infer<typeof demandSchema>) => {
    // Mock lat/lng for simplicity in creation, in a real app would use geocoding
    const payload = {
      ...data,
      lat: -23.5505 + (Math.random() * 0.05 - 0.025),
      lng: -46.6333 + (Math.random() * 0.05 - 0.025),
    };

    createMutation.mutate({ data: payload }, {
      onSuccess: (res) => {
        toast({ title: "Demanda registrada!", description: "Sua solicitação foi enviada com sucesso." });
        setLocation(`/demandas/${res.id}`);
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível registrar a demanda. Tente novamente.", variant: "destructive" });
      }
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-primary" />
            Reportar Problema
          </h1>
          <p className="text-muted-foreground mt-2">
            Descreva a situação detalhadamente para que a prefeitura possa atuar o mais rápido possível.
          </p>
        </div>

        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-base">Título</FormLabel>
                      <CardDescription>Um resumo curto do problema. Ex: Buraco na via, Lâmpada queimada.</CardDescription>
                      <FormControl>
                        <Input placeholder="Ex: Buraco na Rua das Flores" {...field} className="text-lg py-6 bg-muted/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-base">Descrição Detalhada</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva o problema, há quanto tempo está ocorrendo e como afeta a comunidade..." 
                          className="min-h-[150px] resize-none bg-muted/50" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">Categoria</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories?.map(c => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="neighborhoodId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">Bairro</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue placeholder="Selecione o bairro" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {neighborhoods?.map(n => (
                              <SelectItem key={n.id} value={n.id.toString()}>{n.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Endereço / Referência
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Av. Paulista, próximo ao número 1000" {...field} className="bg-muted/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="photoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold flex items-center gap-2">
                        <Camera className="w-4 h-4" /> Foto (Opcional)
                      </FormLabel>
                      <CardDescription>Cole a URL de uma imagem para ilustrar o problema.</CardDescription>
                      <FormControl>
                        <Input placeholder="https://exemplo.com/foto.jpg" {...field} className="bg-muted/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 flex justify-end gap-4">
                  <Button variant="outline" type="button" onClick={() => setLocation("/demandas")}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="lg" className="font-semibold px-8" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Registrar Demanda
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
