const deleteProduct = btn => {
  const prodId = btn.parentNode.querySelector('[name=productId]').value;
  const csrf = btn.parentNode.querySelector('[name=_csrf]').value;

  const productElement = btn.closest('article');
  async function deletef(){
    try{
  const result=await fetch('/admin/product/' + prodId, {
    method: 'DELETE',
    headers: {
      'csrf-token': csrf
    }
  })
  const data= await result.json();
  productElement.remove();
}
  catch(err){
      console.log(err);
    }
  }
  deletef();
}

    

const deleteBtn=document.getElementById('deleteBtn');
deleteBtn.addEventListener('click',function(){deleteProduct(this)});
