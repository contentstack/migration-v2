import { Button, CircularLoader, Field, FieldLabel, Help, Icon, Info, MiniScrollableTable, Paragraph, Select, Tooltip } from "@contentstack/venus-components";
import { useEffect, useState } from "react";
import TableHeader from "./tableHeader";
import SingleRowComp from "./singleRowComp";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";
import { getLocales } from "../../../services/api/upload.service";
import { getStackLocales } from "../../../services/api/stacks.service";
import { all } from "axios";

const Mapper  = ({ cmsLocaleOptions, handleLangugeDelete, options, masterLocale }: { cmsLocaleOptions: Array<any>, handleLangugeDelete: any, options:any, masterLocale:string }) => {

   
    const handleSelectedLocale = (data: any, index: number)=>{
        return;

    }
    
    const csValue = null;
    return (
        <>
        { cmsLocaleOptions?.length > 0 ? 
         cmsLocaleOptions?.map((locale:any, index:any)=>(
        <div key={index} className="lang-container">
                <Select
                value={locale?.value === 'master_locale' ? locale : ''}
                onChange={(key: any) => handleSelectedLocale(key, 1)}
                options={options}
                placeholder={
                'select language'
                }
                isSearchable
                //menuShouldScrollIntoView
                maxMenuHeight={150}
                multiDisplayLimit={5}
                menuPortalTarget={document.querySelector(".language-mapper")}
                width="270px"
                version="v2"
                hideSelectedOptions={true}
                isDisabled={locale?.value === 'master_locale' ? true : false}
                className="select-container"
                noOptionsMessage={() => ''}
                />
                <span className="span" >-</span>
                <Select
                    value={csValue}
                    onChange={(data: any) => handleSelectedLocale(data, 1)}
                    options={[]}
                    placeholder={
                    'select language'
                    }
                    //isSearchable
                    //menuShouldScrollIntoView
                    multiDisplayLimit={5}
                    //menuPortalTarget={document.querySelector(".config-wrapper")}
                    width="270px"
                    version="v2"
                    hideSelectedOptions={true}
                    noOptionsMessage={() => ''}
                />
                <div className={''} >
                    {locale?.value !== 'master_locale' && 
                    <Tooltip
                    content={
                        'Delete'
                    }
                    position="top"
                    showArrow={false}
                    >
                    <Icon
                        icon="Trash"
                        size="mini"
                        className="contentTypeRows__icon"
                        onClick={() => {                           
                            handleLangugeDelete(index, locale)}
                        }
                        hover
                        hoverType="secondary"
                        shadow="medium"
                    />
                    </Tooltip>}
                </div>

        </div>

        )) : 
        <Info
        className="info-tag"
        icon={<Icon icon='Information' version='v2' size='small'></Icon>}
        //version="v2"
        content="No langauges configured"
        type="light"/>
            }
        </>
        
        
    );

}

const LanguageMapper  = () => {
    const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
    const [newEntry, setnewEntry] = useState<boolean>(false);
    const [options, setoptions] = useState([{
        label: '1',
        value: 'hello'
    }]);
    const [cmsLocaleOptions, setcmsLocaleOptions] = useState<{ label: string; value: string }[]>([]);

    
    const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);
    const [isLoading, setisLoading] = useState<boolean>(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setisLoading(true);
                const res = await fetchLocales();
                console.log("res ---> ", res?.data?.locales);
                const allLocales:any = Object.keys(res?.data?.locales || {}).map((key) => ({
                    label: key, 
                    value: key
                }));
                
                setoptions(allLocales);
                setcmsLocaleOptions((prevList: any) => {
          
                    const newLabel = newMigrationData?.destination_stack?.selectedStack?.master_locale;
                
                    const isPresent = prevList.some((item: any) => item.value === 'master_locale');
                  
                    if (!isPresent) {
                      return [
                        ...prevList,
                        {
                          label: newLabel, 
                          value: 'master_locale',
                        },
                      ];
                    }
                    
                    return prevList; 
                  });
                  
                setisLoading(false);
            } catch (error) {
                console.error("Error fetching locales:", error);
            }
        };
    
        fetchData();
    }, []);
    
    const fetchLocales = async () => {
        return await getStackLocales(
            newMigrationData?.destination_stack?.selectedOrg?.value, 
            newMigrationData?.destination_stack?.selectedStack?.value
        );
    };
    const addRowComp = () =>{
        setnewEntry(true);
        setcmsLocaleOptions((prevList: any) => [
            ...prevList,  // Keep existing elements
            {
                label: `${prevList.length + 1}`, // Generate new label
                value: 'name'
            }
        ]);
        

    }

    const handleDeleteLocale= (id:number, locale: any) => {       
        setcmsLocaleOptions((prevList) => {
            return prevList.filter((item:any) => item.label !== locale.label)});

    }
    
    return(
    <div className="mini-table">
        {isLoading ? 
        <CircularLoader></CircularLoader>
         :
         <>
         <MiniScrollableTable
         width={"600px"}
         headerComponent={<TableHeader
         cms={newMigrationData?.legacy_cms?.selectedCms?.parent}/>}
         rowComponent={ 
             <Mapper
             masterLocale={newMigrationData?.destination_stack?.selectedStack?.master_locale}
             options={options}
             cmsLocaleOptions={cmsLocaleOptions}
             handleLangugeDelete={handleDeleteLocale}
             /> }
        //  footerComponent={
        //      <Button className="ml-10 mt-10 mb-10" 
        //      buttonType="secondary"
        //      version={'v2'}
        //      icon="AddPlus"
        //      onClick={addRowComp}
        //      size='small'>
        //          Add Language
        //      </Button>
 
        //  }
         type="Secondary"
         />
         <Button className="ml-10 mt-10 mb-10" 
             buttonType="secondary"
             aria-label="add language"
             version={'v2'}
             icon="AddPlus"
             onClick={addRowComp}
             size='small'>
                 Add Language
             </Button>
         </>
         
          }     
      
    </div>
)

}

export default LanguageMapper;