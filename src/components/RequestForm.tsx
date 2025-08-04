import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useRequests } from '@/hooks/useRequests';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Calculator, Heart, Upload, File, X } from 'lucide-react';

// Schema para dependente
const dependentSchema = z.object({
  name: z.string().min(2, 'Nome do dependente deve ter pelo menos 2 caracteres'),
  relationship: z.string().min(1, 'Selecione o parentesco'),
});

// Schema para o formulário principal
const formSchema = z.object({
  type: z.enum(['psicológico', 'médico', 'odontológico', 'fisioterapia', 'outros'], {
    required_error: 'Selecione o tipo de auxílio',
  }),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  amount: z.number().min(0.01, 'Valor deve ser maior que zero'),
  polo: z.string().min(1, 'Selecione o polo'),
  dependents: z.array(dependentSchema).optional(),
  salary: z.number().min(0, 'Salário deve ser um valor válido').optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Dependent {
  name: string;
  relationship: string;
}

const BASE_SALARY = 2018.36;
const SALARY_PERCENTAGE = 0.9;

export function RequestForm() {
  const { profile } = useAuth();
  const { createRequest, loading } = useRequests();
  const { toast } = useToast();
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: undefined,
      description: '',
      amount: 0,
      polo: '',
      dependents: [],
      salary: 0,
    },
  });

  const watchSalary = form.watch('salary');
  const watchType = form.watch('type');

  // Cálculo automático baseado no salário
  const calculateReimbursement = (salary: number, type: string) => {
    if (salary <= 0) return 0;
    
    const maxReimbursable = salary * SALARY_PERCENTAGE;
    
    // Se o salário é menor ou igual ao piso, reembolso 100%
    if (maxReimbursable <= BASE_SALARY) {
      return BASE_SALARY;
    }
    
    // Caso contrário, reembolsa 90% do salário
    return maxReimbursable;
  };

  const suggestedAmount = calculateReimbursement(watchSalary || 0, watchType || '');

  const addDependent = () => {
    setDependents([...dependents, { name: '', relationship: '' }]);
  };

  const removeDependent = (index: number) => {
    setDependents(dependents.filter((_, i) => i !== index));
  };

  const updateDependent = (index: number, field: keyof Dependent, value: string) => {
    const updated = [...dependents];
    updated[index] = { ...updated[index], [field]: value };
    setDependents(updated);
  };


  const useSuggestedAmount = () => {
    form.setValue('amount', suggestedAmount);
    toast({
      title: "Valor atualizado",
      description: `Valor sugerido de R$ ${suggestedAmount.toFixed(2)} aplicado.`,
    });
  };

  const uploadFiles = async (files: File[]) => {
    if (!profile?.id || files.length === 0) return [];
    
    const uploadedUrls: string[] = [];
    
    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const fileName = `${profile.id}/${Date.now()}-${sanitizedName}`;
        
        const { data, error } = await supabase.storage
          .from('request-attachments')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });
          
        if (error) {
          console.error('Upload error:', error);
          throw new Error(`Erro ao fazer upload do arquivo ${file.name}: ${error.message}`);
        }
        
        if (data) {
          uploadedUrls.push(data.path);
        }
      }
      
      return uploadedUrls;
    } catch (error) {
      console.error('Upload files error:', error);
      throw error;
    }
  };

  async function onSubmit(values: FormData) {
    if (!profile?.id) {
      toast({
        title: "Erro",
        description: "Usuário não encontrado",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      
      // Validar dependentes se foram preenchidos
      const validDependents = dependents.filter(dep => dep.name.trim() && dep.relationship.trim());
      
      // Upload attachments (opcional)
      let uploadedFiles: string[] = [];
      if (attachments.length > 0) {
        try {
          console.log('Iniciando upload de', attachments.length, 'arquivos');
          uploadedFiles = await uploadFiles(attachments);
          console.log('Upload concluído. Arquivos:', uploadedFiles);
        } catch (uploadError) {
          console.error('Erro no upload de arquivos:', uploadError);
          toast({
            title: "Aviso",
            description: "Erro ao fazer upload dos anexos, mas a solicitação será criada.",
            variant: "destructive",
          });
        }
      }
      
      const requestData = {
        type: values.type,
        description: values.description,
        amount: values.amount,
        polo: values.polo,
        dependents: validDependents,
        attachments: uploadedFiles,
      };

      console.log('Dados da solicitação:', requestData);
      await createRequest(requestData);
      
      // Reset form and dependents
      form.reset();
      setDependents([]);
      setAttachments([]);
      setShowCalculator(false);
      
      toast({
        title: "Sucesso!",
        description: "Solicitação criada com sucesso",
      });
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="w-full bg-card/50 backdrop-blur-sm border-primary/20">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-primary flex items-center gap-2">
          <Heart className="h-6 w-6" />
          Nova Solicitação
        </CardTitle>
        <CardDescription>
          Preencha os dados para solicitar auxílio financeiro
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Calculadora de Reembolso */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Calculadora de Reembolso</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCalculator(!showCalculator)}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  {showCalculator ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>
              
              {showCalculator && (
                <div className="bg-gradient-subtle p-4 rounded-lg border border-primary/20 space-y-4">
                  <FormField
                    control={form.control}
                    name="salary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salário Bruto Mensal</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Digite seu salário"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {suggestedAmount > 0 && (
                    <div className="bg-success-light p-3 rounded-md border border-success/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-success">💰 Valor Sugerido de Reembolso</p>
                          <p className="text-lg font-bold text-success">R$ {suggestedAmount.toFixed(2)}</p>
                          <p className="text-xs text-success/80">
                            {suggestedAmount === BASE_SALARY 
                              ? `Piso mínimo: 100% até R$ ${BASE_SALARY.toFixed(2)}`
                              : `90% do salário: R$ ${(watchSalary * SALARY_PERCENTAGE).toFixed(2)}`
                            }
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={useSuggestedAmount}
                          className="bg-success hover:bg-success/90"
                        >
                          Usar Valor
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tipo de Auxílio */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Auxílio</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de auxílio" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="psicológico">Auxílio Psicológico</SelectItem>
                      <SelectItem value="médico">Auxílio Médico</SelectItem>
                      <SelectItem value="odontológico">Auxílio Odontológico</SelectItem>
                      <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Polo */}
            <FormField
              control={form.control}
              name="polo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Polo de Trabalho</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione seu polo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sumare">Sumaré</SelectItem>
                      <SelectItem value="itapetininga">Itapetininga</SelectItem>
                      <SelectItem value="manaus">Manaus</SelectItem>
                      <SelectItem value="ribeirao_preto">Ribeirão Preto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dependentes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Dependentes</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDependent}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Dependente
                </Button>
              </div>
              
              {dependents.length > 0 && (
                <div className="space-y-3">
                  {dependents.map((dependent, index) => (
                    <div key={index} className="bg-gradient-subtle p-4 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="secondary">Dependente {index + 1}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDependent(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Nome do Dependente</label>
                          <Input
                            placeholder="Nome completo"
                            value={dependent.name}
                            onChange={(e) => updateDependent(index, 'name', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Parentesco</label>
                          <Select
                            value={dependent.relationship}
                            onValueChange={(value) => updateDependent(index, 'relationship', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="filho">Filho(a)</SelectItem>
                              <SelectItem value="conjuge">Cônjuge</SelectItem>
                              <SelectItem value="pai">Pai</SelectItem>
                              <SelectItem value="mae">Mãe</SelectItem>
                              <SelectItem value="irmao">Irmão(ã)</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Descrição */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição Detalhada</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva detalhadamente sua necessidade e como o auxílio será utilizado..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Valor */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Solicitado (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Anexos */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Anexos (PDF, Imagens)</label>
              <div className="border-2 border-dashed border-primary/20 rounded-lg p-4">
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAttachments(prev => [...prev, ...files]);
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground text-center">
                      Clique para adicionar arquivos<br />
                      (PDF, JPG, PNG, GIF, WebP - máx. 50MB)
                    </p>
                  </div>
                </label>
                
                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <File className="h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024 / 1024).toFixed(1)} MB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAttachments(prev => prev.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button type="submit" disabled={loading || uploading} className="w-full">
              {uploading ? 'Fazendo upload...' : loading ? 'Enviando...' : 'Enviar Solicitação'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}